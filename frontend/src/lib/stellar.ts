import {
  Horizon, TransactionBuilder, Operation, Asset, Memo,
  rpc, Contract, Account, Address, nativeToScVal, scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, HORIZON_URL, RPC_URL, IS_MAINNET, STELLAR_EXPERT_BASE } from './network';

export { NETWORK_PASSPHRASE, HORIZON_URL, RPC_URL, IS_MAINNET };

const BASE_FEE = '100';
const PALENGKEPAY_MEMO_PREFIX = 'PP:';

// ── Horizon ───────────────────────────────────────────────────────────────────

export function getServer(): Horizon.Server {
  return new Horizon.Server(HORIZON_URL);
}

export async function fetchBalance(address: string): Promise<string> {
  const server = getServer();
  const account = await server.accounts().accountId(address).call();
  const native = account.balances.find((b) => b.asset_type === 'native');
  return native ? parseFloat(native.balance).toFixed(2) : '0.00';
}

export async function buildPaymentTx(
  from: string,
  to: string,
  amount: string,
  memo?: string,
  rawMemo?: boolean
): Promise<string> {
  const server = getServer();
  const [account, destExists] = await Promise.all([
    server.loadAccount(from),
    server.loadAccount(to).then(() => true).catch(() => false),
  ]);

  const parsedAmount = parseFloat(amount).toFixed(7);
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (destExists) {
    builder.addOperation(Operation.payment({
      destination: to,
      asset: Asset.native(),
      amount: parsedAmount,
    }));
  } else {
    // Destination account not yet funded on testnet — activate + pay in one op
    builder.addOperation(Operation.createAccount({
      destination: to,
      startingBalance: parsedAmount,
    }));
  }

  // Anchor deposits (cashout) need the memo verbatim — the anchor matches it
  // literally against the txn id it handed out, so no branding prefix here.
  const memoText = rawMemo
    ? (memo?.trim() ?? '').slice(0, 28)
    : `${PALENGKEPAY_MEMO_PREFIX}${memo?.trim() || 'PalengkePay'}`.slice(0, 28);
  builder.addMemo(Memo.text(memoText));

  return builder.setTimeout(300).build().toXDR();
}

export async function submitTx(signedXdr: string): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
  const server = getServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  return server.submitTransaction(tx);
}

// ── Soroban RPC ───────────────────────────────────────────────────────────────

export function getRpcServer(): rpc.Server {
  return new rpc.Server(RPC_URL);
}

// Dummy account used as simulation source — palengkepay admin, valid 56-char testnet address.
const SIMULATION_SOURCE = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

/** Read-only contract call via simulation. Returns decoded JS value or null on failure. */
export async function simulateViewCall(
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<unknown> {
  const server = getRpcServer();
  const contract = new Contract(contractId);
  const account = new Account(SIMULATION_SOURCE, '0');

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) return null;
  return scValToNative(result.result.retval);
}

/** Simulate + assemble a state-changing contract call. Returns prepared XDR ready to sign. */
export async function prepareContractTx(
  signerAddress: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<string> {
  const server = getRpcServer();
  const contract = new Contract(contractId);
  const account = await server.getAccount(signerAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    const err = (simResult as rpc.Api.SimulateTransactionErrorResponse).error;
    throw new Error(err ?? 'Simulation failed');
  }

  return rpc.assembleTransaction(tx, simResult).build().toXDR();
}

/** Current ledger sequence — used to compute a SEP-41 `approve` expiration_ledger. */
export async function getLatestLedgerSequence(): Promise<number> {
  const server = getRpcServer();
  const { sequence } = await server.getLatestLedger();
  return sequence;
}

export interface ContractEventRecord {
  id: string;
  ledger: number;
  closedAt: string;
  txHash: string;
  topics: string[];
  value: unknown;
}

interface RawEventsResult {
  events?: {
    id: string;
    ledger: number;
    ledgerClosedAt: string;
    txHash: string;
    topic: string[];
    value: string;
  }[];
}

// The public testnet RPC silently returns an EMPTY (not erroring) events page
// once startLedger is too far back — empirically the cutoff sits around
// 10-12k ledgers even though getLatestLedger's own oldestLedger advertises a
// much longer retention. Paginate in chunks under that cutoff so distant
// history isn't silently dropped, capped at a total lookback to keep the
// request count for a manual "Refresh" click bounded.
const EVENT_CHUNK_LEDGERS = 9_000;
const EVENT_MAX_LOOKBACK_LEDGERS = 45_000;

/** Fetch contract events whose first topic segment matches `topic0` (any
 *  second segment), from `EVENT_MAX_LOOKBACK_LEDGERS` back through latest.
 *
 *  Calls the RPC directly instead of `rpc.Server.getEvents` — that helper
 *  decodes every event's topic/value in one batch, so a single legacy or
 *  unrelated event that this SDK build can't decode (observed in-browser
 *  against long-lived testnet contracts) throws and drops the whole page of
 *  events. Decoding one event at a time here means a bad event is skipped,
 *  not fatal. */
export async function fetchContractEvents(
  contractId: string,
  topic0: string
): Promise<ContractEventRecord[]> {
  const { sequence: latest } = await getRpcServer().getLatestLedger();
  const topicFilter = nativeToScVal(topic0, { type: 'symbol' }).toXDR('base64');
  const lookbackStart = Math.max(1, latest - EVENT_MAX_LOOKBACK_LEDGERS);

  const records: ContractEventRecord[] = [];
  for (let chunkStart = lookbackStart; chunkStart <= latest; chunkStart += EVENT_CHUNK_LEDGERS) {
    const chunkEnd = Math.min(latest, chunkStart + EVENT_CHUNK_LEDGERS);
    try {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `${contractId}-${topic0}-${chunkStart}`,
          method: 'getEvents',
          params: {
            startLedger: chunkStart,
            endLedger: chunkEnd,
            filters: [{ type: 'contract', contractIds: [contractId], topics: [[topicFilter, '*']] }],
            limit: 200,
          },
        }),
      });
      const json = (await res.json()) as { result?: RawEventsResult; error?: { message?: string } };
      if (json.error) throw new Error(json.error.message ?? 'RPC getEvents failed');

      for (const event of json.result?.events ?? []) {
        try {
          records.push({
            id: event.id,
            ledger: event.ledger,
            closedAt: event.ledgerClosedAt,
            txHash: event.txHash,
            topics: event.topic.map((t) => String(scValToNative(xdr.ScVal.fromXDR(t, 'base64')))),
            value: scValToNative(xdr.ScVal.fromXDR(event.value, 'base64')),
          });
        } catch (decodeErr) {
          console.warn(`[vault-events] skipping undecodable event ${event.id}`, decodeErr); // eslint-disable-line no-console
        }
      }
    } catch (chunkErr) {
      // One bad chunk (RPC hiccup, transient decode failure) shouldn't blank
      // out every other chunk's real data — skip it and keep going.
      console.warn(`[vault-events] skipping chunk ${chunkStart}-${chunkEnd}`, chunkErr); // eslint-disable-line no-console
    }
  }
  return records;
}

/** Submit a signed Soroban tx and poll until confirmed. Returns tx hash + the
 *  contract fn's decoded return value (null for void-returning fns). */
export async function submitSorobanTxAndDecode(
  signedXdr: string
): Promise<{ hash: string; returnValue: unknown }> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === 'ERROR') {
    throw new Error('Transaction rejected by network');
  }

  const hash = sendResult.hash;
  let attempts = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    const getResult = await server.getTransaction(hash);
    if (getResult.status === 'SUCCESS') {
      const returnValue = getResult.returnValue != null
        ? scValToNative(getResult.returnValue)
        : null;
      return { hash, returnValue };
    }
    if (getResult.status === 'FAILED') throw new Error('Transaction failed on-chain');
    if (++attempts > 15) throw new Error('Transaction timed out');
  }
}

/** Submit a signed Soroban tx and poll until confirmed. Returns tx hash. */
export async function submitSorobanTx(signedXdr: string): Promise<string> {
  const { hash } = await submitSorobanTxAndDecode(signedXdr);
  return hash;
}

// ── ScVal helpers ─────────────────────────────────────────────────────────────

export function addressToScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function u64ToScVal(value: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'u64' });
}

export function u32ToScVal(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: 'u32' });
}

export function i128ToScVal(value: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'i128' });
}

export function stringToScVal(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'string' });
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Hex string has odd length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function bytes32ToScVal(hex: string): xdr.ScVal {
  const buf = hexToBytes(hex);
  if (buf.length !== 32) throw new Error(`Expected 32 bytes, got ${buf.length}`);
  return nativeToScVal(buf, { type: 'bytes' });
}

export function bytesToHex(buf: Uint8Array): string {
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Fee Bump (Gasless) ────────────────────────────────────────────────────────

/** Send signed inner XDR through the fee-bump server. Sponsor pays the fee.
 *  Falls back to direct Horizon submit when fee-bump endpoint is unavailable (local dev). */
export async function submitWithFeeBump(signedInnerXdr: string): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
  const feeBumpUrl = import.meta.env.VITE_FEE_BUMP_URL ?? '/api/fee-bump';

  const res = await fetch(feeBumpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ innerXdr: signedInnerXdr }),
  });

  if (res.status === 404) {
    // Fee-bump endpoint not available (local dev) — submit inner tx directly
    return submitTx(signedInnerXdr);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Fee bump failed' })) as { error?: string };
    throw new Error(body.error ?? 'Fee bump failed');
  }

  const { feeBumpXdr } = await res.json() as { feeBumpXdr: string };
  return submitTx(feeBumpXdr);
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function truncateAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function stellarExpertUrl(txHash: string): string {
  return `${STELLAR_EXPERT_BASE}/tx/${txHash}`;
}

export function stellarExpertAccountUrl(address: string): string {
  return `${STELLAR_EXPERT_BASE}/account/${address}`;
}

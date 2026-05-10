import {
  Horizon, TransactionBuilder, Networks, Operation, Asset, Memo,
  rpc, Contract, Account, Address, nativeToScVal, scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const BASE_FEE = '100';

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
  memo?: string
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

  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));

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

/** Submit a signed Soroban tx and poll until confirmed. Returns tx hash. */
export async function submitSorobanTx(signedXdr: string): Promise<string> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === 'ERROR') {
    throw new Error('Transaction rejected by network');
  }

  const hash = sendResult.hash;
  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    const getResult = await server.getTransaction(hash);
    if (getResult.status === 'SUCCESS') return hash;
    if (getResult.status === 'FAILED') throw new Error('Transaction failed on-chain');
    if (++attempts > 15) throw new Error('Transaction timed out');
  }
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
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

export { NETWORK_PASSPHRASE };

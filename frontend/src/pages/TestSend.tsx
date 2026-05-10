import { useState } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/hooks/useWallet';
import { usePayment } from '../lib/hooks/usePayment';
import { TxStatusTracker } from '../components/TxStatusTracker';

export function TestSend() {
  const { address, isConnected, connect } = useWallet();
  const { status, txHash, error, sendPayment, reset } = usePayment();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!address) {
      setValidationError('Connect your wallet first');
      return;
    }
    if (!to || to.length < 56) {
      setValidationError('Enter a valid Stellar address (G...)');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setValidationError('Enter an amount greater than 0');
      return;
    }

    await sendPayment(address, to, amount, memo);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Test Send XLM</h1>
      </div>

      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-amber-700 mb-3">Connect your wallet to send XLM.</p>
          <button
            onClick={connect}
            className="text-sm font-medium bg-teal-700 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Recipient Address
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="G..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Amount (XLM)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Memo <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. 2kg tilapia"
            maxLength={28}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-300"
          />
        </div>

        {validationError && (
          <p className="text-xs text-red-600">{validationError}</p>
        )}

        <button
          type="submit"
          disabled={!isConnected || status !== 'idle'}
          className="w-full flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-600 active:scale-95 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={16} />
          Send XLM
        </button>
      </form>

      <TxStatusTracker
        status={status}
        txHash={txHash}
        error={error}
        amount={amount}
        onRetry={reset}
      />
    </div>
  );
}

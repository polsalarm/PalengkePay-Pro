import { useState } from 'react';
import { Bell, BellOff, Check, Loader2, Send } from 'lucide-react';
import { usePushNotifications } from '../lib/hooks/usePushNotifications';

interface Props {
  /** Whose perspective — affects copy. */
  role?: 'vendor' | 'customer';
  /** Stellar wallet to key the subscription by. Required for server-side fan-out. */
  wallet?: string | null;
}

/**
 * Card-style prompt asking the user to enable browser push notifications.
 * Falls back gracefully when the device/browser doesn't support push.
 */
export function PushPrompt({ role = 'vendor', wallet }: Props) {
  const { permission, subscribed, isSupported, isPending, enable, disable, sendTest, error } = usePushNotifications(wallet);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'sent' | 'failed'>('idle');

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    const ok = await sendTest({
      title: role === 'vendor' ? 'PalengkePay — test alert' : 'PalengkePay — test reminder',
      body: role === 'vendor' ? 'Push notifications are working on this device.' : 'You will get reminders for utang and payments.',
    });
    setTesting(false);
    setTestResult(ok ? 'sent' : 'failed');
    setTimeout(() => setTestResult('idle'), 3000);
  };

  if (!isSupported) {
    return (
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
      >
        <BellOff size={16} style={{ color: '#94A3B8' }} />
        <p className="text-xs text-slate-500">Push notifications not supported on this browser.</p>
      </div>
    );
  }

  const denied = permission === 'denied';
  const granted = permission === 'granted' && subscribed;

  if (granted) {
    return (
      <div
        className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
        style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Check size={16} style={{ color: '#16A34A' }} />
          <p className="text-xs font-bold" style={{ color: '#15803D' }}>
            {testResult === 'sent' ? 'Test push sent — check your notifications'
              : testResult === 'failed' ? (error ?? 'Test failed')
              : 'Notifications on'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTest}
            disabled={testing || isPending}
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}
            title="Send a test push to this device"
          >
            {testing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            Test
          </button>
          <button
            onClick={disable}
            disabled={isPending}
            className="text-xs font-bold disabled:opacity-50"
            style={{ color: '#16A34A' }}
          >
            {isPending ? '…' : 'Off'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
      style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#FEF3C7' }}
        >
          <Bell size={16} style={{ color: '#D97706' }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold" style={{ color: '#92400E' }}>
            {role === 'vendor' ? 'Get alerts on every payment' : 'Get alerts for utang reminders'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#A16207' }}>
            {denied
              ? 'Notifications blocked — re-enable in browser settings.'
              : error ?? "Even when the app isn't open."}
          </p>
        </div>
      </div>
      <button
        onClick={enable}
        disabled={isPending || denied}
        className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 text-white disabled:opacity-50"
        style={{ backgroundColor: '#D97706' }}
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : 'Enable'}
      </button>
    </div>
  );
}

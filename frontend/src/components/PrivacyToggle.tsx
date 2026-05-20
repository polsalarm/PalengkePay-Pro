import { Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '../lib/hooks/usePrivacy';

interface Props {
  variant?: 'dark' | 'light';
}

/** Tap to hide / show balance figures. Masks numeric amounts with ••••. */
export function PrivacyToggle({ variant = 'dark' }: Props) {
  const { hidden, toggle } = usePrivacy();
  const isDark = variant === 'dark';

  return (
    <button
      onClick={toggle}
      className="rounded-full p-1.5 transition-all active:scale-95"
      style={isDark
        ? { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }
        : { backgroundColor: '#F1F5F9', color: '#475569' }
      }
      aria-label={hidden ? 'Show balance' : 'Hide balance'}
      title={hidden ? 'Show balance' : 'Hide balance'}
    >
      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}

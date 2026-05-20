import { useDisplayUnit, type DisplayUnit } from '../lib/hooks/useDisplayUnit';

interface Props {
  /** "dark" matches translucent-on-navy hero (VendorHome). "light" matches white surface. */
  variant?: 'dark' | 'light';
}

/**
 * PHP / XLM display-unit switcher. Mirrors the EN/TL language toggle's styling.
 * XLM stays the on-chain settlement asset — this only changes UI presentation.
 */
export function UnitToggle({ variant = 'dark' }: Props) {
  const { unit, setUnit } = useDisplayUnit();

  const isDark = variant === 'dark';
  const activeBg = '#008055';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.45)' : '#64748B';
  const containerBg = isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9';

  return (
    <div
      className="flex items-center rounded-full p-0.5"
      style={{ backgroundColor: containerBg }}
    >
      {(['xlm', 'php'] as const).map((u: DisplayUnit) => (
        <button
          key={u}
          onClick={() => setUnit(u)}
          className="text-xs font-bold px-3 py-1 rounded-full transition-all"
          style={unit === u
            ? { backgroundColor: activeBg, color: 'white' }
            : { color: inactiveColor }
          }
        >
          {u === 'xlm' ? 'XLM' : '₱'}
        </button>
      ))}
    </div>
  );
}

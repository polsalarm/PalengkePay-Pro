import { useCallback, useEffect, useState } from 'react';
import { formatPhp, xlmToPhp } from '../rate';
import { usePhpRate } from './usePhpRate';
import { HIDDEN_MASK, usePrivacy } from './usePrivacy';

export type DisplayUnit = 'xlm' | 'php';

const STORAGE_KEY = 'pp_display_unit';
const EVENT_NAME = 'pp:unit-change';

function readStored(): DisplayUnit {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'php' ? 'php' : 'xlm';
  } catch {
    return 'xlm';
  }
}

function writeStored(unit: DisplayUnit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
    window.dispatchEvent(new CustomEvent<DisplayUnit>(EVENT_NAME, { detail: unit }));
  } catch { /* quota — skip */ }
}

export function useDisplayUnit() {
  const [unit, setUnitState] = useState<DisplayUnit>(() => readStored());

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<DisplayUnit>).detail;
      if (next === 'php' || next === 'xlm') setUnitState(next);
    };
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, []);

  const setUnit = useCallback((next: DisplayUnit) => {
    writeStored(next);
    setUnitState(next);
  }, []);

  const toggle = useCallback(() => setUnit(unit === 'xlm' ? 'php' : 'xlm'), [unit, setUnit]);

  return { unit, setUnit, toggle };
}

export interface FormatOptions {
  /** Number of XLM digits when displaying in XLM (default 2). */
  xlmDigits?: number;
  /** Show unit suffix (e.g. "XLM" or "₱"). Default true. */
  showSuffix?: boolean;
}

/**
 * Returns a formatter that renders an XLM amount in the user's chosen display unit.
 * XLM stays the on-chain settlement asset — this only changes UI presentation.
 * Also respects privacy mode (hide-balance) — when hidden, returns the mask string.
 */
export function useFormatAmount() {
  const { unit } = useDisplayUnit();
  const { rate } = usePhpRate();
  const { hidden } = usePrivacy();

  const format = useCallback((xlm: number, opts: FormatOptions = {}): string => {
    const { xlmDigits = 2, showSuffix = true } = opts;
    if (hidden) return showSuffix ? `${HIDDEN_MASK} ${unit === 'php' ? 'PHP' : 'XLM'}` : HIDDEN_MASK;
    if (unit === 'php') {
      const value = xlmToPhp(xlm, rate);
      return showSuffix ? formatPhp(value) : value.toFixed(2);
    }
    const value = xlm.toFixed(xlmDigits);
    return showSuffix ? `${value} XLM` : value;
  }, [unit, rate, hidden]);

  /** Companion sub-line, e.g. "≈ ₱22.50" when primary unit is XLM, and vice versa. */
  const formatCompanion = useCallback((xlm: number): string => {
    if (hidden) return `≈ ${HIDDEN_MASK}`;
    if (unit === 'php') return `≈ ${xlm.toFixed(2)} XLM`;
    return `≈ ${formatPhp(xlmToPhp(xlm, rate))}`;
  }, [unit, rate, hidden]);

  return { unit, rate, format, formatCompanion, hidden };
}

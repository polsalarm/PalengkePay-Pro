import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'pp_balance_hidden';
const EVENT_NAME = 'pp:privacy-change';

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(hidden: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
    window.dispatchEvent(new CustomEvent<boolean>(EVENT_NAME, { detail: hidden }));
  } catch { /* quota — skip */ }
}

export function usePrivacy() {
  const [hidden, setHiddenState] = useState<boolean>(() => readStored());

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      setHiddenState(Boolean(next));
    };
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, []);

  const setHidden = useCallback((next: boolean) => {
    writeStored(next);
    setHiddenState(next);
  }, []);

  const toggle = useCallback(() => {
    setHidden(!hidden);
  }, [hidden, setHidden]);

  return { hidden, setHidden, toggle };
}

/** Constant mask string used wherever balance values should be hidden. */
export const HIDDEN_MASK = '••••';

import { useEffect, useState } from 'react';
import { fetchPhpRate, getCachedRate, type RateState } from '../rate';

let inFlight: Promise<RateState> | null = null;

export function usePhpRate() {
  const [state, setState] = useState<RateState>(() => getCachedRate());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (state.isFresh) return;
    let cancelled = false;
    setIsLoading(true);
    if (!inFlight) inFlight = fetchPhpRate().finally(() => { inFlight = null; });
    inFlight.then((s) => {
      if (cancelled) return;
      setState(s);
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, isLoading };
}

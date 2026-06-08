import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: ApiError | Error | undefined;
  reload: () => void;
  setData: (next: T) => void;
}

/** Run an async fetcher on mount + whenever a dep changes; expose reload. */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList
): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error>();
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(undefined);
    fetcher()
      .then((res) => {
        if (live && mounted.current) setData(res);
      })
      .catch((e: unknown) => {
        if (live && mounted.current)
          setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (live && mounted.current) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload, setData };
}

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/api';
import { parseConfig, type ConfigNamespace, type ConfigValue } from '@resume/contracts';
import type { SaveStatus } from '@/components/SaveBar';

export interface ConfigForm<NS extends ConfigNamespace> {
  value: ConfigValue<NS> | undefined;
  loading: boolean;
  loadError: Error | undefined;
  status: SaveStatus;
  set: (next: ConfigValue<NS>) => void;
  reload: () => void;
  save: () => Promise<void>;
}

// Load a config namespace, hold an editable draft, validate client-side with the
// @resume/contracts Zod (parseConfig) BEFORE PUT (brief requirement).
export function useConfig<NS extends ConfigNamespace>(ns: NS): ConfigForm<NS> {
  const [value, setValue] = useState<ConfigValue<NS>>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error>();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(undefined);
    api
      .config(ns)
      .then((v) => {
        if (live) setValue(v);
      })
      .catch((e: unknown) => {
        if (live) setLoadError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [ns, nonce]);

  const set = useCallback((next: ConfigValue<NS>) => {
    setValue(next);
    setStatus({ kind: 'idle' });
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const save = useCallback(async () => {
    if (value === undefined) return;
    const parsed = parseConfig(ns, value);
    if (!parsed.success) {
      setStatus({
        kind: 'error',
        message: `Invalid ${ns} config`,
        problems: parsed.error.issues.map(
          (i) => `${i.path.join('/')} ${i.message}`
        ),
      });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      await api.putConfig(ns, parsed.data);
      setStatus({ kind: 'saved' });
      setValue(parsed.data);
    } catch (e) {
      if (e instanceof ApiError)
        setStatus({ kind: 'error', message: e.message, problems: e.problems });
      else setStatus({ kind: 'error', message: String(e) });
    }
  }, [ns, value]);

  return { value, loading, loadError, status, set, reload, save };
}

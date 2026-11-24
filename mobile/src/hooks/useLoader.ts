import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { isApiError } from '@/api/errors';

export function useLoader<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasData = useRef(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (mode: 'load' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else if (!hasData.current) setLoading(true);
    setError(null);
    try {
      const next = await loadRef.current();
      hasData.current = true;
      setData(next);
    } catch (caught) {
      setError(isApiError(caught) ? caught.code : 'generic');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void run('load');
  }, [run]));

  return { data, error, loading, refreshing, reload: () => run('refresh') };
}

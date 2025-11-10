'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '@/lib/api';

const PipelinesContext = createContext({
  pipelineConfig: null,
  hydrating: false,
  hydrated: false,
  refreshPipelineConfig: async () => {},
});

export function usePipelinesContext() {
  const context = useContext(PipelinesContext);
  if (!context) {
    throw new Error('usePipelinesContext must be used within PipelinesLayout');
  }
  return context;
}

export default function PipelinesLayout({ children }) {
  const [pipelineConfig, setPipelineConfig] = useState(null);
  const [hydrating, setHydrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refreshPipelineConfig = useCallback(async () => {
    try {
      setHydrating(true);
      const response = await api.get('/api/pipelines/config');
      setPipelineConfig(response.data ?? null);
      setHydrated(true);
    } catch (error) {
      console.warn('Pipeline config API unavailable, falling back to default.', error);
      setPipelineConfig(null);
      setHydrated(true);
    } finally {
      setHydrating(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      refreshPipelineConfig();
    }
  }, [hydrated, refreshPipelineConfig]);

  const value = useMemo(
    () => ({
      pipelineConfig,
      hydrating,
      hydrated,
      refreshPipelineConfig,
    }),
    [pipelineConfig, hydrating, hydrated, refreshPipelineConfig],
  );

  return (
    <PipelinesContext.Provider value={value}>{children}</PipelinesContext.Provider>
  );
}

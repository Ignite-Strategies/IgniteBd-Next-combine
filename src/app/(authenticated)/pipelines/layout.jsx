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

  // Load from localStorage only - no auto-fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const cached = window.localStorage.getItem('pipelineConfig');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setPipelineConfig(parsed);
        setHydrated(true);
      } catch (error) {
        console.warn('Failed to parse cached pipeline config', error);
      }
    }
  }, []);

  const refreshPipelineConfig = useCallback(async () => {
    try {
      setHydrating(true);
      const response = await api.get('/api/pipelines/config');
      const config = response.data ?? null;
      setPipelineConfig(config);
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pipelineConfig', JSON.stringify(config));
      }
      setHydrated(true);
    } catch (error) {
      console.warn('Pipeline config API unavailable, falling back to default.', error);
      setPipelineConfig(null);
      setHydrated(true);
    } finally {
      setHydrating(false);
    }
  }, []);

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

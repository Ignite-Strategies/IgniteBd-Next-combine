'use client';

import { createContext, useContext } from 'react';

export const PipelinesContext = createContext({
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


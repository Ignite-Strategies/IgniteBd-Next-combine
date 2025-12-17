'use client';

import { createContext, useContext } from 'react';

export const ProposalsContext = createContext({
  proposals: [],
  setProposals: () => {},
  companyHQId: '',
  hydrated: false,
  hydrating: false, // Always false - no auto-hydrating
  refreshProposals: async () => {}, // Manual refresh only
  updateProposal: (proposalId, updates) => {},
  addProposal: (proposal) => {},
  removeProposal: (proposalId) => {},
});

export function useProposals() {
  const context = useContext(ProposalsContext);
  if (!context) {
    throw new Error('useProposals must be used within ProposalsLayout');
  }
  return context;
}


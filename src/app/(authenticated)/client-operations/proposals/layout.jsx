'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';

// Note: Proposals are hydrated by Growth Dashboard via useCompanyHydration hook
// This layout just reads from localStorage - no separate API calls

const ProposalsContext = createContext({
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

export default function ProposalsLayout({ children }) {
  const { companyHQId } = useCompanyHQ();
  const [proposals, setProposals] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  // Read from localStorage only - hydrated by Growth Dashboard
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cached = window.localStorage.getItem('proposals');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setProposals(parsed);
          setHydrated(true);
        }
      } catch (error) {
        console.warn('Failed to parse cached proposals', error);
      }
    }
  }, []);

  // Manual refresh only (for when user explicitly wants to refresh/sync)
  const refreshProposals = useCallback(async () => {
    if (!companyHQId) return;

    setHydrating(true);
    try {
      const response = await api.get(`/api/proposals?companyHQId=${companyHQId}`);
      const fetchedProposals = response.data?.proposals ?? [];
      
      setProposals(fetchedProposals);
      
      // Update localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('proposals', JSON.stringify(fetchedProposals));
      }
      setHydrated(true);
    } catch (error) {
      console.error('Error syncing proposals:', error);
    } finally {
      setHydrating(false);
    }
  }, [companyHQId]);

  // Helper: Update a single proposal in state and localStorage
  const updateProposal = useCallback((proposalId, updates) => {
    setProposals((prev) => {
      const updated = prev.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, ...updates } : proposal
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('proposals', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Helper: Add a new proposal to state and localStorage
  const addProposal = useCallback((proposal) => {
    setProposals((prev) => {
      const updated = [...prev, proposal];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('proposals', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Helper: Remove a proposal from state and localStorage
  const removeProposal = useCallback((proposalId) => {
    setProposals((prev) => {
      const updated = prev.filter((proposal) => proposal.id !== proposalId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('proposals', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      proposals,
      setProposals,
      companyHQId,
      hydrated,
      hydrating, // Only true when manually syncing
      refreshProposals,
      updateProposal,
      addProposal,
      removeProposal,
    }),
    [proposals, companyHQId, hydrated, hydrating, refreshProposals, updateProposal, addProposal, removeProposal],
  );

  return (
    <ProposalsContext.Provider value={contextValue}>
      {children}
    </ProposalsContext.Provider>
  );
}


'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { ProposalsContext } from './ProposalsContext';

// Note: Proposals are hydrated by Growth Dashboard
// This layout just reads from localStorage - no separate API calls

function ProposalsLayoutContent({ children }) {
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
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

export default function ProposalsLayout({ children }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    }>
      <ProposalsLayoutContent>{children}</ProposalsLayoutContent>
    </Suspense>
  );
}


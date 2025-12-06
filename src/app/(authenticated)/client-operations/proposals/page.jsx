'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useProposals } from '@/hooks/useProposals';
import { useContacts } from '@/app/(authenticated)/contacts/layout';

export default function ClientOperationsProposalsPage() {
  const router = useRouter();
  const { proposals, hydrated, hydrating, refreshProposals } = useProposals();
  const { contacts } = useContacts();

  const stats = useMemo(() => {
    const total = proposals.length;
    const draft = proposals.filter((p) => p.status === 'draft').length;
    const active = proposals.filter((p) => p.status === 'active').length;
    const approved = proposals.filter((p) => p.status === 'approved').length;
    return { total, draft, active, approved };
  }, [proposals]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Client Operations - Proposals"
          subtitle="Create and manage proposals with contact-first operations."
        />

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="rounded-lg bg-white px-4 py-3 shadow">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="rounded-lg bg-white px-4 py-3 shadow">
              <p className="text-xs text-gray-500">Draft</p>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            </div>
            <div className="rounded-lg bg-white px-4 py-3 shadow">
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
            </div>
            <div className="rounded-lg bg-white px-4 py-3 shadow">
              <p className="text-xs text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshProposals}
              disabled={hydrating}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg 
                className={`h-4 w-4 ${hydrating ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {hydrating ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={() => router.push('/client-operations/proposals/create')}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Create Proposal
            </button>
          </div>
        </div>

        <div className="mt-6">
          {hydrating ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow">
              <p className="text-sm font-semibold text-gray-600">Loading proposals…</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow">
              <p className="text-lg font-semibold text-gray-800">No proposals yet</p>
              <p className="mt-2 text-sm text-gray-600">
                Create your first proposal to get started.
              </p>
              <button
                onClick={() => router.push('/client-operations/proposals/create')}
                className="mt-4 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Create Proposal
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  onClick={() => router.push(`/client-operations/proposals/${proposal.id}`)}
                  className="cursor-pointer rounded-lg bg-white p-6 shadow transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {proposal.clientName}
                      </h3>
                      <p className="text-sm text-gray-600">{proposal.clientCompany}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        proposal.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : proposal.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {proposal.status}
                    </span>
                  </div>
                  {proposal.purpose && (
                    <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                      {proposal.purpose}
                    </p>
                  )}
                  {proposal.totalPrice && (
                    <p className="mt-3 text-lg font-bold text-gray-900">
                      ${proposal.totalPrice.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


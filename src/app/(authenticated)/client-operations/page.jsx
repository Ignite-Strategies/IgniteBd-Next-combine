'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { useProposals } from './proposals/layout';
import { useContacts } from '@/app/(authenticated)/contacts/layout';

export default function ClientOperationsPage() {
  const router = useRouter();
  const { proposals } = useProposals();
  const { contacts } = useContacts();

  // Get recent proposals and contacts for quick access
  const recentProposals = proposals.slice(0, 3);
  const recentContacts = contacts.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Client Operations"
          subtitle="Lead clients through the journey from proposal to contract sign to delivery"
        />

        {/* Welcome Section */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to Ignite Client Operations
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              This is where all the pieces and parts you put in here lead a client through the journey to contract sign and then delivery. Ready to get going?
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Set Your Proposal */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Set Your Proposal
                </h3>
                <p className="text-gray-600">
                  Create or select a proposal to start the client journey. Proposals define the engagement scope, deliverables, and pricing.
                </p>
              </div>
              <svg
                className="h-8 w-8 text-red-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push('/client-operations/proposals/create')}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Create New Proposal
              </button>
              <button
                onClick={() => router.push('/client-operations/proposals')}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                View All Proposals
              </button>
            </div>
            {recentProposals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Proposals</p>
                <div className="space-y-2">
                  {recentProposals.map((proposal) => (
                    <button
                      key={proposal.id}
                      onClick={() => router.push(`/client-operations/proposals/${proposal.id}`)}
                      className="w-full text-left text-sm text-gray-700 hover:text-red-600 transition"
                    >
                      {proposal.clientName} - {proposal.clientCompany}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Invite Prospect to Client Portal */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Invite Your Prospect to Client Portal
                </h3>
                <p className="text-gray-600">
                  Generate portal access for your contact. They'll receive a password reset link to set up their account and access proposals and deliverables.
                </p>
              </div>
              <svg
                className="h-8 w-8 text-blue-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div className="mt-6">
              <button
                onClick={() => router.push('/client-operations/invite-prospect')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Select Contact to Invite
              </button>
            </div>
            {recentContacts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Contacts</p>
                <div className="space-y-2">
                  {recentContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                      className="w-full text-left text-sm text-gray-700 hover:text-blue-600 transition flex items-center justify-between"
                    >
                      <span>
                        {contact.firstName} {contact.lastName} {contact.email && `(${contact.email})`}
                      </span>
                      <span className="text-xs text-gray-400">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white px-4 py-3 shadow border border-gray-200">
            <p className="text-xs text-gray-500">Total Proposals</p>
            <p className="text-2xl font-bold text-gray-900">{proposals.length}</p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 shadow border border-gray-200">
            <p className="text-xs text-gray-500">Draft Proposals</p>
            <p className="text-2xl font-bold text-gray-600">
              {proposals.filter((p) => p.status === 'draft').length}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 shadow border border-gray-200">
            <p className="text-xs text-gray-500">Active Proposals</p>
            <p className="text-2xl font-bold text-blue-600">
              {proposals.filter((p) => p.status === 'active').length}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 shadow border border-gray-200">
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-2xl font-bold text-green-600">
              {proposals.filter((p) => p.status === 'approved').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


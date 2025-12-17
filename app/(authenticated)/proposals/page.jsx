'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState([]);
  const [companyHQId, setCompanyHQId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load from localStorage only - no auto-fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedId);

    // Only load from localStorage
    const cached = window.localStorage.getItem('proposals');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setProposals(parsed);
        }
      } catch (error) {
        console.warn('Failed to parse cached proposals', error);
      }
    }
    setLoading(false);
  }, []);

  const fetchProposals = async (tenantId) => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/api/proposals?companyHQId=${tenantId}`);
      const proposalsData = response.data?.proposals ?? [];
      setProposals(proposalsData);
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('proposals', JSON.stringify(proposalsData));
      }
    } catch (err) {
      setError('Unable to load proposals.');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = proposals.length;
    const draft = proposals.filter((proposal) => proposal.status === 'draft').length;
    const sent = proposals.filter((proposal) => proposal.status === 'sent').length;
    const signed = proposals.filter((proposal) => proposal.status === 'signed').length;
    return { total, draft, sent, signed };
  }, [proposals]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Proposals"
          subtitle="Build, send, and track proposals that move deals forward."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fetchProposals(companyHQId)}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow transition hover:bg-gray-100"
              >
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push('/proposals/builder')}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                New Proposal
              </button>
            </div>
          }
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Total" value={stats.total} />
          <Stat label="Drafts" value={stats.draft} tone="text-gray-600" />
          <Stat label="Sent" value={stats.sent} tone="text-blue-600" />
          <Stat label="Signed" value={stats.signed} tone="text-green-600" />
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading proposals…</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-lg font-semibold text-gray-800">No proposals yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Create your first proposal to formalize scope, pricing, and next steps.
            </p>
            <button
              type="button"
              onClick={() => router.push('/proposals/builder')}
              className="mt-6 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Create Proposal →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <button
                key={proposal.id}
                type="button"
                onClick={() => router.push(`/proposals/${proposal.id}`)}
                className="flex w-full flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {proposal.status || 'draft'}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-gray-900">
                    {proposal.clientName || 'Unnamed Client'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {proposal.clientCompany || 'Company TBD'}
                  </p>
                </div>
                <div className="space-y-1 text-right text-sm text-gray-500">
                  <p>
                    Value:{' '}
                    <span className="font-semibold text-gray-900">
                      {proposal.totalPrice
                        ? `$${proposal.totalPrice.toLocaleString()}`
                        : 'Not set'}
                    </span>
                  </p>
                  <p>
                    Updated:{' '}
                    <span className="font-semibold text-gray-900">
                      {proposal.updatedAt
                        ? new Date(proposal.updatedAt).toLocaleDateString()
                        : new Date(proposal.createdAt).toLocaleDateString()}
                    </span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center shadow">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

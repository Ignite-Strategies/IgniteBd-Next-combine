'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, DollarSign, Users, Calendar } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function ProposalDetailPage({ params }) {
  const router = useRouter();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/proposals/${params.proposalId}`);
        if (!isMounted) return;
        if (response.data?.proposal) {
          setProposal(response.data.proposal);
        } else {
          setError('Proposal not found.');
        }
      } catch (err) {
        if (!isMounted) return;
        setError('Unable to load proposal details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    hydrate();
    return () => {
      isMounted = false;
    };
  }, [params.proposalId]);

  const headerTitle = useMemo(() => {
    if (!proposal) return 'Proposal';
    return proposal.clientName
      ? `${proposal.clientName} • ${proposal.clientCompany || 'Client'}`
      : 'Proposal';
  }, [proposal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading proposal…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">
              {error || 'Proposal not found.'}
            </p>
            <button
              type="button"
              onClick={() => router.push('/proposals')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to Proposals
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={headerTitle}
          subtitle={proposal.purpose || 'Client proposal overview'}
          backTo="/proposals"
          backLabel="Back to Proposals"
          actions={
            <button
              type="button"
              onClick={() => router.push(`/proposals/builder?proposalId=${proposal.id}`)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Edit Proposal
            </button>
          }
        />

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <FileText className="h-5 w-5 text-gray-500" />
              Summary
            </h3>
            <dl className="space-y-3 text-sm text-gray-600">
              <div>
                <dt className="font-semibold text-gray-700">Status</dt>
                <dd className="capitalize">{proposal.status || 'draft'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Purpose</dt>
                <dd>{proposal.purpose || 'Define proposal goals to keep scope tight.'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Users className="h-5 w-5 text-gray-500" />
              Client Details
            </h3>
            <dl className="space-y-3 text-sm text-gray-600">
              <div>
                <dt className="font-semibold text-gray-700">Client</dt>
                <dd>{proposal.clientName || 'TBD'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Company</dt>
                <dd>{proposal.clientCompany || 'TBD'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Prepared By</dt>
                <dd>{proposal.preparedBy || 'Not set'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <DollarSign className="h-5 w-5 text-gray-500" />
              Commercials
            </h3>
            <dl className="space-y-3 text-sm text-gray-600">
              <div>
                <dt className="font-semibold text-gray-700">Total Price</dt>
                <dd>
                  {proposal.totalPrice
                    ? `$${proposal.totalPrice.toLocaleString()}`
                    : 'Price pending'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Compensation Model</dt>
                <dd>
                  {proposal.compensation
                    ? JSON.stringify(proposal.compensation, null, 2)
                    : 'Outline compensation structure in the builder.'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Calendar className="h-5 w-5 text-gray-500" />
              Timeline & Milestones
            </h3>
            <p className="text-sm text-gray-600">
              {proposal.milestones
                ? JSON.stringify(proposal.milestones, null, 2)
                : 'Add milestones in the proposal builder to show phased delivery.'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

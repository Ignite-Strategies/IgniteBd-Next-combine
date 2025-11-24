'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, TrendingUp, ArrowLeft, DollarSign, Calendar, MapPin } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';
import ScoreCard from '@/components/enrichment/ScoreCard';

export default function CompanyDetailPage({ params }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [company, setCompany] = useState(null);
  const [companyId, setCompanyId] = useState(null);

  // Handle params (may be sync or async in Next.js)
  useEffect(() => {
    const resolveParams = async () => {
      if (params && typeof params.then === 'function') {
        const resolvedParams = await params;
        setCompanyId(resolvedParams?.companyId);
      } else if (params?.companyId) {
        setCompanyId(params.companyId);
      }
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!companyId) return;

    let isMounted = true;
    const loadCompany = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.get(`/api/companies/${companyId}`);
        if (!isMounted) return;

        if (response.data?.success && response.data.company) {
          setCompany(response.data.company);
        } else {
          setError(response.data?.error || 'Company not found');
        }
      } catch (err: any) {
        console.error('Error loading company:', err);
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Failed to load company');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCompany();
    return () => {
      isMounted = false;
    };
  }, [companyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">Loading company…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">{error || 'Company not found.'}</p>
            <button
              type="button"
              onClick={() => router.push('/contacts')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to Contacts
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={company.companyName}
          subtitle="Company intelligence, stats, and related contacts"
          backTo="/contacts"
          backLabel="Back to Contacts"
        />

        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-gray-600 shadow hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {company.domain && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
              {company.domain}
            </span>
          )}
        </div>

        <div className="space-y-6">
          {/* Company Intelligence Header */}
          {(company.companyHealthScore !== null ||
            company.growthScore !== null ||
            company.stabilityScore !== null ||
            company.marketPositionScore !== null ||
            company.readinessScore !== null) && (
            <section className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 p-6 shadow">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
                <h3 className="text-xl font-bold text-gray-900">Company Intelligence</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ScoreCard
                  label="Health"
                  score={company.companyHealthScore}
                  description="Overall company health"
                />
                <ScoreCard
                  label="Growth"
                  score={company.growthScore}
                  description="Growth trajectory"
                />
                <ScoreCard
                  label="Stability"
                  score={company.stabilityScore}
                  description="Financial stability"
                />
                <ScoreCard
                  label="Market Position"
                  score={company.marketPositionScore}
                  description="Market competitiveness"
                />
                <ScoreCard
                  label="Readiness"
                  score={company.readinessScore}
                  description="Readiness to buy/partner"
                />
              </div>
            </section>
          )}

          {/* Stats Panel */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Company Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {company.headcount !== null && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Headcount</dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {company.headcount.toLocaleString()}
                  </dd>
                </div>
              )}
              {company.revenue !== null && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Revenue</dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    ${(company.revenue / 1000000).toFixed(1)}M
                  </dd>
                </div>
              )}
              {company.revenueRange && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Revenue Range</dt>
                  <dd className="text-2xl font-bold text-gray-900">{company.revenueRange}</dd>
                </div>
              )}
              {company.growthRate !== null && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Growth Rate</dt>
                  <dd className="text-2xl font-bold text-gray-900">{company.growthRate}%</dd>
                </div>
              )}
              {company.fundingStage && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Funding Stage</dt>
                  <dd className="text-lg font-semibold text-gray-900 capitalize">
                    {company.fundingStage}
                  </dd>
                </div>
              )}
              {company.lastFundingAmount !== null && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Last Funding</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    ${(company.lastFundingAmount / 1000000).toFixed(1)}M
                  </dd>
                </div>
              )}
              {company.lastFundingDate && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Funding Date</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(company.lastFundingDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {company.numberOfFundingRounds !== null && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Funding Rounds</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {company.numberOfFundingRounds}
                  </dd>
                </div>
              )}
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.industry && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Industry: {company.industry}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Website:{' '}
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {company.website}
                    </a>
                  </span>
                </div>
              )}
            </div>
          </section>


          {/* Related Contacts */}
          {company.contacts && company.contacts.length > 0 && (
            <section className="rounded-2xl bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Related Contacts ({company.contacts.length})
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Buyer Signals
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Pipeline
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {company.contacts.map((contact: any) => (
                      <tr
                        key={contact.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/contacts/${contact.id}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {contact.goesBy ||
                            [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
                            'Unnamed'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{contact.title || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{contact.email || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {contact.decisionMaker && (
                              <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                                Decision Maker
                              </span>
                            )}
                            {contact.budgetAuthority && (
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                Budget Authority
                              </span>
                            )}
                            {contact.readinessToBuyScore !== null && contact.readinessToBuyScore > 75 && (
                              <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800">
                                High Readiness
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {contact.pipeline?.pipeline && (
                            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600">
                              {contact.pipeline.pipeline}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}


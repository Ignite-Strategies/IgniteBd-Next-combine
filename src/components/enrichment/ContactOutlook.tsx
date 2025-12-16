'use client';

import { Building2, TrendingUp, Clock, Target, Zap, Briefcase, Shield } from 'lucide-react';
import ScoreCard from './ScoreCard';

// Safe formatter for numeric values
const fmt = (s: number | null | undefined): string => {
  return typeof s === 'number' ? s.toFixed(1) : '—';
};

interface ContactOutlookProps {
  contact: any;
  onViewRawJSON?: (json: any) => void;
}

export default function ContactOutlook({ contact, onViewRawJSON }: ContactOutlookProps) {
  const hasEnrichment = contact.enrichmentSource || contact.enrichmentRedisKey;
  const hasIntelligenceScores = 
    contact.seniorityScore !== null || 
    contact.buyingPowerScore !== null ||
    contact.urgencyScore !== null;

  // Buyer Classification
  const buyerSignals = [
    { label: 'Decision Maker', value: contact.decisionMaker, icon: Target },
    { label: 'Budget Authority', value: contact.budgetAuthority, icon: Zap },
    { label: 'Influencer', value: contact.influencer, icon: TrendingUp },
    { label: 'Gatekeeper', value: contact.gatekeeper, icon: Shield },
  ];

  const handleViewRawJSON = async () => {
    if (!contact.enrichmentRedisKey || !onViewRawJSON) return;
    
    try {
      // Fetch raw JSON from Redis via API
      const response = await fetch(`/api/contacts/enrich/raw?redisKey=${encodeURIComponent(contact.enrichmentRedisKey)}`);
      if (response.ok) {
        const data = await response.json();
        onViewRawJSON(data.rawEnrichmentPayload);
      } else {
        console.error('Failed to fetch raw JSON');
      }
    } catch (error) {
      console.error('Failed to fetch raw JSON:', error);
    }
  };

  if (!hasEnrichment && !hasIntelligenceScores) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Buyer Intelligence Overview */}
      {hasIntelligenceScores && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Buyer Intelligence Overview</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreCard
              label="Seniority"
              score={contact.seniorityScore}
              description="Title-based seniority level (C-level: 90-100, VP: 70-89, Director: 50-69)"
            />
            <ScoreCard
              label="Buying Power"
              score={contact.buyingPowerScore}
              description="Authority + company budget capacity"
            />
            <ScoreCard
              label="Role Power"
              score={contact.rolePowerScore}
              description="Decision-making power in their role"
            />
            <ScoreCard
              label="Readiness"
              score={contact.readinessToBuyScore}
              description="How ready they are to purchase"
            />
            <ScoreCard
              label="Urgency"
              score={contact.urgencyScore}
              description="How urgent their need is"
            />
            <ScoreCard
              label="Career Momentum"
              score={contact.careerMomentumScore}
              description="Career trajectory indicators"
            />
            <ScoreCard
              label="Career Stability"
              score={contact.careerStabilityScore}
              description="Job stability metrics"
            />
            <ScoreCard
              label="Buyer Likelihood"
              score={contact.buyerLikelihoodScore}
              description="Probability they're a buyer"
            />
          </div>
        </section>
      )}

      {/* Buyer Classification Box */}
      {(contact.decisionMaker !== null || contact.budgetAuthority !== null || 
        contact.influencer !== null || contact.gatekeeper !== null) && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Buyer Classification</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {buyerSignals.map((signal) => {
              const Icon = signal.icon;
              if (signal.value === null || signal.value === undefined) return null;
              return (
                <div
                  key={signal.label}
                  className={`rounded-lg border p-4 ${
                    signal.value
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${signal.value ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-semibold text-gray-700">{signal.label}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {signal.value ? 'Yes' : 'No'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Enrichment Snapshot Box */}
      {hasEnrichment && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Enrichment Snapshot</h3>
            {contact.enrichmentRedisKey && onViewRawJSON && (
              <button
                onClick={handleViewRawJSON}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Full JSON
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Source</dt>
                <dd className="mt-1 text-gray-900">{contact.enrichmentSource || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Fetched At</dt>
                <dd className="mt-1 text-gray-900">
                  {contact.enrichmentFetchedAt
                    ? new Date(contact.enrichmentFetchedAt).toLocaleDateString()
                    : '—'}
                </dd>
              </div>
            </div>

            {/* Normalized Fields Summary */}
            {(contact.title || contact.department || contact.seniority) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Professional Info</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {contact.title && (
                    <div>
                      <dt className="text-xs text-gray-500">Title</dt>
                      <dd className="mt-1 text-gray-900">{contact.title}</dd>
                    </div>
                  )}
                  {contact.department && (
                    <div>
                      <dt className="text-xs text-gray-500">Department</dt>
                      <dd className="mt-1 text-gray-900">{contact.department}</dd>
                    </div>
                  )}
                  {contact.seniority && (
                    <div>
                      <dt className="text-xs text-gray-500">Seniority</dt>
                      <dd className="mt-1 text-gray-900">{contact.seniority}</dd>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Company Snapshot */}
            {(contact.companyName || contact.companyDomain || contact.company?.companyName || contact.companies?.companyName || contact.contactCompany?.companyName) && (
              <div className="rounded-lg border border-gray-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-semibold text-gray-700">Company</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">Name</dt>
                    <dd className="mt-1 text-gray-900">
                      {contact.companies?.companyName || contact.company?.companyName || contact.contactCompany?.companyName || contact.companyName || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Domain</dt>
                    <dd className="mt-1 text-gray-900">
                      {contact.companies?.domain || contact.company?.domain || contact.contactCompany?.domain || contact.companyDomain || '—'}
                    </dd>
                  </div>
                  {(contact.companies?.companyHealthScore !== null && contact.companies?.companyHealthScore !== undefined) ||
                   (contact.company?.companyHealthScore !== null && contact.company?.companyHealthScore !== undefined) ||
                   (contact.contactCompany?.companyHealthScore !== null && contact.contactCompany?.companyHealthScore !== undefined) ? (
                    <div>
                      <dt className="text-xs text-gray-500">Health Score</dt>
                      <dd className="mt-1 text-gray-900">
                        {contact.companies?.companyHealthScore ?? contact.company?.companyHealthScore ?? contact.contactCompany?.companyHealthScore ?? '—'}/100
                      </dd>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Profile Summary */}
      {contact.profileSummary && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Profile Summary</h3>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{contact.profileSummary}</p>
          {(contact.currentTenureYears !== null || contact.totalExperienceYears !== null || contact.avgTenureYears !== null) && (
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 text-sm">
              {contact.currentTenureYears !== null && contact.currentTenureYears !== undefined && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase">Current Tenure</dt>
                  <dd className="mt-1 text-gray-900 font-semibold">{fmt(contact.currentTenureYears)} {contact.currentTenureYears === 1 ? 'year' : 'years'}</dd>
                </div>
              )}
              {contact.totalExperienceYears !== null && contact.totalExperienceYears !== undefined && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase">Total Experience</dt>
                  <dd className="mt-1 text-gray-900 font-semibold">{fmt(contact.totalExperienceYears)} {contact.totalExperienceYears === 1 ? 'year' : 'years'}</dd>
                </div>
              )}
              {contact.avgTenureYears !== null && contact.avgTenureYears !== undefined && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase">Avg Tenure</dt>
                  <dd className="mt-1 text-gray-900 font-semibold">{fmt(contact.avgTenureYears)} {contact.avgTenureYears === 1 ? 'year' : 'years'}</dd>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Career Timeline */}
      {contact.careerTimeline && Array.isArray(contact.careerTimeline) && contact.careerTimeline.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Career Timeline</h3>
          </div>
          <div className="space-y-3">
            {contact.careerTimeline.map((role: any, index: number) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-600 mt-2"></div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-semibold text-gray-900">{role.title}</p>
                      <p className="text-sm text-gray-600">{role.company}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{new Date(role.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                      <p>{role.endDate ? new Date(role.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Present'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {role.durationYears > 0 ? `${fmt(role.durationYears)} ${role.durationYears === 1 ? 'year' : 'years'}` : `${role.durationMonths} ${role.durationMonths === 1 ? 'month' : 'months'}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Career Snapshot (fallback if no timeline) */}
      {(!contact.careerTimeline || !Array.isArray(contact.careerTimeline) || contact.careerTimeline.length === 0) && contact.numberOfJobChanges !== null && contact.numberOfJobChanges > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Career Snapshot</h3>
          </div>
          <div className="space-y-3">
            {contact.totalYearsExperience !== null && contact.totalYearsExperience !== undefined && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Total Experience</span>
                <span className="text-sm font-semibold text-gray-900">
                  {fmt(contact.totalYearsExperience)} years
                </span>
              </div>
            )}
            {contact.numberOfJobChanges !== null && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Job Changes</span>
                <span className="text-sm font-semibold text-gray-900">
                  {contact.numberOfJobChanges}
                </span>
              </div>
            )}
            {contact.averageTenureMonths !== null && contact.averageTenureMonths !== undefined && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Avg Tenure</span>
                <span className="text-sm font-semibold text-gray-900">
                  {contact.averageTenureMonths !== null && contact.averageTenureMonths !== undefined
                    ? fmt(contact.averageTenureMonths / 12)
                    : '—'} years
                </span>
              </div>
            )}
            {contact.careerProgression && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Progression</span>
                <span className="text-sm font-semibold text-gray-900 capitalize">
                  {contact.careerProgression}
                </span>
              </div>
            )}
            {contact.recentJobChange && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">Recent job change (last 6 months)</span>
              </div>
            )}
            {contact.recentPromotion && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">Recent promotion (last 12 months)</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}


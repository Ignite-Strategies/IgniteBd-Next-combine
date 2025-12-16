'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2, Save, Building2, User, TrendingUp, Mail } from 'lucide-react';
import api from '@/lib/api';
import ScoreCard from './ScoreCard';
import {
  extractSeniorityScore,
  extractBuyingPowerScore,
  extractUrgencyScore,
  extractRolePowerScore,
  extractCareerMomentumScore,
  extractCareerStabilityScore,
  extractBuyerLikelihoodScore,
  extractReadinessToBuyScore,
  extractCompanyIntelligenceScores,
  type ApolloEnrichmentPayload,
} from '@/lib/intelligence/EnrichmentParserService';

// Safe formatter for numeric values
const fmt = (s: number | null | undefined): string => {
  return typeof s === 'number' ? s.toFixed(1) : '—';
};

interface EnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  contactEmail?: string; // Optional - if provided, can enrich by email
  onEnrichmentSaved?: (updatedContact?: any) => void;
}

interface PreviewData {
  enrichedContact: any;
  rawApolloResponse: any;
  redisKey: string;
  intelligenceScores?: {
    seniorityScore: number;
    buyingPowerScore: number;
    urgencyScore: number;
    rolePowerScore: number;
    buyerLikelihoodScore: number;
    readinessToBuyScore: number;
    careerMomentumScore: number;
    careerStabilityScore: number;
  };
  companyIntelligence?: {
    companyHealthScore: number;
    growthScore: number;
    stabilityScore: number;
    marketPositionScore: number;
    readinessScore: number;
  };
}

export default function EnrichmentModal({
  isOpen,
  onClose,
  contactId,
  contactEmail,
  onEnrichmentSaved,
}: EnrichmentModalProps) {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [enrichmentMethod, setEnrichmentMethod] = useState<'email' | 'linkedin'>(
    contactEmail ? 'email' : 'linkedin'
  );

  if (!isOpen) return null;

  const handleEnrichByEmail = async () => {
    if (!contactEmail) {
      setError('Contact does not have an email address');
      return;
    }

    setLoading(true);
    setError('');
    setPreviewData(null);

    try {
      const response = await api.post('/api/contacts/enrich/by-email', {
        contactId,
      });

      if (response.data?.success) {
        const rawResponse = response.data.rawApolloResponse;
        
        // Compute intelligence scores client-side for preview
        const apolloPayload = rawResponse as ApolloEnrichmentPayload;
        
        const intelligenceScores = {
          seniorityScore: extractSeniorityScore(apolloPayload),
          buyingPowerScore: extractBuyingPowerScore(apolloPayload),
          urgencyScore: extractUrgencyScore(apolloPayload),
          rolePowerScore: extractRolePowerScore(apolloPayload),
          buyerLikelihoodScore: extractBuyerLikelihoodScore(apolloPayload),
          readinessToBuyScore: extractReadinessToBuyScore(apolloPayload),
          careerMomentumScore: extractCareerMomentumScore(apolloPayload),
          careerStabilityScore: extractCareerStabilityScore(apolloPayload),
        };

        const companyIntelligence = extractCompanyIntelligenceScores(apolloPayload);

        setPreviewData({
          enrichedContact: response.data.enrichedContact,
          rawApolloResponse: rawResponse,
          redisKey: response.data.redisKey,
          intelligenceScores,
          companyIntelligence,
        });
      } else {
        setError(response.data?.error || 'Failed to enrich contact by email');
      }
    } catch (err: any) {
      console.error('Enrichment error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to enrich contact by email');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!linkedinUrl.trim()) {
      setError('Please enter a LinkedIn URL');
      return;
    }

    setLoading(true);
    setError('');
    setPreviewData(null);

    try {
      const response = await api.post('/api/contacts/enrich', {
        contactId,
        linkedinUrl: linkedinUrl.trim(),
      });

      if (response.data?.success) {
        const rawResponse = response.data.rawApolloResponse;
        
        // Compute intelligence scores client-side for preview
        const apolloPayload = rawResponse as ApolloEnrichmentPayload;
        
        const intelligenceScores = {
          seniorityScore: extractSeniorityScore(apolloPayload),
          buyingPowerScore: extractBuyingPowerScore(apolloPayload),
          urgencyScore: extractUrgencyScore(apolloPayload),
          rolePowerScore: extractRolePowerScore(apolloPayload),
          buyerLikelihoodScore: extractBuyerLikelihoodScore(apolloPayload),
          readinessToBuyScore: extractReadinessToBuyScore(apolloPayload),
          careerMomentumScore: extractCareerMomentumScore(apolloPayload),
          careerStabilityScore: extractCareerStabilityScore(apolloPayload),
        };

        const companyIntelligence = extractCompanyIntelligenceScores(apolloPayload);

        setPreviewData({
          enrichedContact: response.data.enrichedContact,
          rawApolloResponse: rawResponse,
          redisKey: response.data.redisKey,
          intelligenceScores,
          companyIntelligence,
        });
      } else {
        setError(response.data?.error || 'Failed to enrich contact');
      }
    } catch (err: any) {
      console.error('Enrichment error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to enrich contact');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!previewData?.redisKey) {
      setError('No enrichment data to save');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await api.post('/api/contacts/enrich/save', {
        contactId,
        redisKey: previewData.redisKey,
        previewId: previewData.previewId, // Pass previewId if available for inference fields
      });

      if (response.data?.success) {
        // Pass the updated contact data to the callback
        if (onEnrichmentSaved) {
          onEnrichmentSaved(response.data.contact);
        }
        handleClose();
      } else {
        setError(response.data?.error || 'Failed to save enrichment');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save enrichment');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setLinkedinUrl('');
    setPreviewData(null);
    setError('');
    onClose();
  };

  const contact = previewData?.enrichedContact;
  const company = contact?.organization || (previewData?.rawApolloResponse as any)?.person?.organization;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Enrich Contact</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] px-6 py-6">
          {!previewData ? (
            // Step A: Enrichment Method Selection
            <div className="space-y-6">
              {contactEmail ? (
                // Email enrichment available - show as primary option
                <div className="space-y-4">
                  <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Mail className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Enrich by Email</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Enrich this contact using their email address: <strong>{contactEmail}</strong>
                    </p>
                    {error && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    )}
                    <button
                      onClick={handleEnrichByEmail}
                      disabled={loading}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enriching...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Enrich by Email
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-2 text-gray-500">OR</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Enrich by LinkedIn URL (Alternative)
                    </label>
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      disabled={loading}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Enter the LinkedIn profile URL to enrich this contact
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handlePreview}
                      disabled={loading || !linkedinUrl.trim()}
                      className="flex items-center gap-2 rounded-lg bg-gray-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enriching...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Preview from LinkedIn
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleClose}
                      className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // No email - show LinkedIn input only
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      disabled={loading}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Enter the LinkedIn profile URL to enrich this contact
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handlePreview}
                      disabled={loading || !linkedinUrl.trim()}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enriching...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Preview Enrichment
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleClose}
                      className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Step B: Preview Panel
            <div className="space-y-6">
              {/* Contact Preview Card */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <User className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Contact Preview</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">Full Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{contact?.fullName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">Title</dt>
                    <dd className="mt-1 text-sm text-gray-900">{contact?.title || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">Department</dt>
                    <dd className="mt-1 text-sm text-gray-900">{contact?.department || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">Seniority</dt>
                    <dd className="mt-1 text-sm text-gray-900">{contact?.seniority || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{contact?.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">Phone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{contact?.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">LinkedIn</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {contact?.linkedinUrl ? (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Profile
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase">Location</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {[contact?.city, contact?.state, contact?.country]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </dd>
                  </div>
                </div>
              </div>

              {/* Company Preview Card */}
              {company && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <Building2 className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Company Preview</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Company Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{company.name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Domain</dt>
                      <dd className="mt-1 text-sm text-gray-900">{company.primary_domain || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Industry</dt>
                      <dd className="mt-1 text-sm text-gray-900">{company.industry || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Size</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {company.employees || company.estimated_num_employees
                          ? `${company.employees || company.estimated_num_employees} employees`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Revenue</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {company.annual_revenue !== null && company.annual_revenue !== undefined
                          ? `$${fmt(company.annual_revenue / 1000000)}M`
                          : company.revenue_range || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Headcount</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {company.employees || company.estimated_num_employees || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Growth Rate</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {company.growth_rate ? `${company.growth_rate}%` : '—'}
                      </dd>
                    </div>
                  </div>
                </div>
              )}

              {/* Intelligence Scores Panel */}
              {previewData.intelligenceScores && (
                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Intelligence Scores</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ScoreCard
                      label="Seniority"
                      score={previewData.intelligenceScores.seniorityScore}
                      description="Title-based seniority level"
                    />
                    <ScoreCard
                      label="Buying Power"
                      score={previewData.intelligenceScores.buyingPowerScore}
                      description="Authority + company budget capacity"
                    />
                    <ScoreCard
                      label="Urgency"
                      score={previewData.intelligenceScores.urgencyScore}
                      description="How urgent their need is"
                    />
                    <ScoreCard
                      label="Role Power"
                      score={previewData.intelligenceScores.rolePowerScore}
                      description="Decision-making power in role"
                    />
                    <ScoreCard
                      label="Buyer Likelihood"
                      score={previewData.intelligenceScores.buyerLikelihoodScore}
                      description="Probability they're a buyer"
                    />
                    <ScoreCard
                      label="Readiness"
                      score={previewData.intelligenceScores.readinessToBuyScore}
                      description="How ready they are to purchase"
                    />
                    <ScoreCard
                      label="Career Momentum"
                      score={previewData.intelligenceScores.careerMomentumScore}
                      description="Career trajectory indicators"
                    />
                    <ScoreCard
                      label="Career Stability"
                      score={previewData.intelligenceScores.careerStabilityScore}
                      description="Job stability metrics"
                    />
                  </div>
                </div>
              )}

              {/* Company Intelligence Scores */}
              {previewData.companyIntelligence && (
                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <Building2 className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Company Intelligence</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <ScoreCard
                      label="Health"
                      score={previewData.companyIntelligence.companyHealthScore}
                      description="Overall company health"
                    />
                    <ScoreCard
                      label="Growth"
                      score={previewData.companyIntelligence.growthScore}
                      description="Growth trajectory"
                    />
                    <ScoreCard
                      label="Stability"
                      score={previewData.companyIntelligence.stabilityScore}
                      description="Financial stability"
                    />
                    <ScoreCard
                      label="Market Position"
                      score={previewData.companyIntelligence.marketPositionScore}
                      description="Market competitiveness"
                    />
                    <ScoreCard
                      label="Readiness"
                      score={previewData.companyIntelligence.readinessScore}
                      description="Readiness to buy/partner"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Step C: Save Button */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Enrichment to Contact
                    </>
                  )}
                </button>
                <button
                  onClick={() => setPreviewData(null)}
                  className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


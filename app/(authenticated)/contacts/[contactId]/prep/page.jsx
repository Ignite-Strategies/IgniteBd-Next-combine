'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle, Sparkles, FileText, TrendingUp, User } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';

/**
 * Contact Prep Page
 * 
 * Displays Contact Analysis for meeting prep
 * Shows: talk track, scores, risks, opportunities, meeting summary
 */
export default function ContactPrepPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params?.contactId;

  const [contact, setContact] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    if (contactId) {
      loadContactAndAnalysis();
    }
  }, [contactId]);

  const loadContactAndAnalysis = async () => {
    setLoading(true);
    setError('');

    try {
      // Load contact
      const contactResponse = await api.get(`/api/contacts/${contactId}`);
      if (contactResponse.data?.success && contactResponse.data?.contact) {
        setContact(contactResponse.data.contact);
      }

      // Load analysis if exists
      try {
        const analysisResponse = await api.get(`/api/contacts/${contactId}/analysis`);
        if (analysisResponse.data?.success && analysisResponse.data?.analysis) {
          setAnalysis(analysisResponse.data.analysis);
        }
      } catch (err) {
        // Analysis doesn't exist yet - that's ok
        console.log('No analysis found yet');
      }
    } catch (err) {
      console.error('Failed to load contact:', err);
      setError(err.response?.data?.error || 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await api.post(`/api/contacts/${contactId}/analysis`, {
        // productId is optional - can add product selector later
      });

      if (response.data?.success && response.data?.analysis) {
        setAnalysis(response.data.analysis);
      } else {
        throw new Error(response.data?.error || 'Failed to generate analysis');
      }
    } catch (err) {
      console.error('Failed to generate analysis:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate analysis');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-500 mb-4" />
            <p className="text-sm font-semibold text-gray-600">Loading contact prep...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !contact) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <AlertCircle className="mx-auto h-6 w-6 text-red-500 mb-4" />
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Go Back
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
          title={`Meeting Prep: ${contact?.fullName || contact?.firstName || 'Contact'}`}
          subtitle="How to speak with this person"
          backTo="/meetings"
          backLabel="Back to Meetings"
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!analysis ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Analysis Generated Yet
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Generate meeting prep analysis to see talk track, scores, and insights for this contact.
              </p>
              <button
                onClick={handleGenerateAnalysis}
                disabled={generating}
                className="flex items-center gap-2 mx-auto rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Recommended Talk Track (Key Output) */}
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Recommended Talk Track</h3>
              </div>
              <div className="rounded-lg bg-white p-4 border border-blue-100">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {analysis.recommendedTalkTrack || 'No talk track generated yet.'}
                </p>
              </div>
            </div>

            {/* Scores */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Analysis Scores</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ScoreCard label="Fit Score" value={analysis.fitScore} />
                <ScoreCard label="Pain Alignment" value={analysis.painAlignmentScore} />
                <ScoreCard label="Workflow Fit" value={analysis.workflowFitScore} />
                <ScoreCard label="Urgency" value={analysis.urgencyScore} />
                <ScoreCard label="Adoption Barrier" value={analysis.adoptionBarrierScore} />
              </div>
            </div>

            {/* Meeting Summary */}
            {analysis.finalSummary && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Meeting Summary</h3>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {analysis.finalSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Risks and Opportunities */}
            {(analysis.risks || analysis.opportunities) && (
              <div className="grid md:grid-cols-2 gap-6">
                {analysis.risks && Array.isArray(analysis.risks) && analysis.risks.length > 0 && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-red-900 mb-4">Risks to Consider</h3>
                    <ul className="space-y-2">
                      {analysis.risks.map((risk, idx) => (
                        <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.opportunities && Array.isArray(analysis.opportunities) && analysis.opportunities.length > 0 && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-green-900 mb-4">Opportunities</h3>
                    <ul className="space-y-2">
                      {analysis.opportunities.map((opp, idx) => (
                        <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{opp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Regenerate Button */}
            <div className="flex justify-end">
              <button
                onClick={handleGenerateAnalysis}
                disabled={generating}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Regenerate Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value }) {
  const score = value ?? 0;
  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${
        color === 'green' ? 'text-green-600' :
        color === 'yellow' ? 'text-yellow-600' :
        'text-red-600'
      }`}>
        {score}
      </div>
    </div>
  );
}


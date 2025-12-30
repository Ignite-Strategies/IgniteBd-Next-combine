'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

/**
 * Relationship-Aware AI Template Page
 * User fills relationship form, AI generates template, then navigates to template builder
 */
function RelationshipAwareTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const { ownerId } = useOwner();
  const [relationship, setRelationship] = useState('WARM');
  const [typeOfPerson, setTypeOfPerson] = useState('FORMER_COWORKER');
  const [whyReachingOut, setWhyReachingOut] = useState('');
  const [whatWantFromThem, setWhatWantFromThem] = useState('');
  const [timeSinceConnected, setTimeSinceConnected] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('');
  const [knowledgeOfBusiness, setKnowledgeOfBusiness] = useState(false);
  const [myBusinessDescription, setMyBusinessDescription] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/templates/create/ai/relationship?companyHQId=${stored}`);
      } else {
        router.push('/templates');
      }
    }
  }, [companyHQId, router]);

  // Log CompanyHQ from URL params
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [companyHQId]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!whyReachingOut.trim()) {
      setError('Please explain why you\'re reaching out');
      return;
    }

    if (!ownerId) {
      setError('Owner not found. Please refresh the page.');
      return;
    }

    try {
      setGenerating(true);
      setError('');

      // Call the generate-relationship-aware endpoint with ownerId for signature
      const response = await api.post('/api/template/generate-relationship-aware', {
        relationship: relationship,
        typeOfPerson: typeOfPerson,
        whyReachingOut: whyReachingOut.trim(),
        whatWantFromThem: whatWantFromThem.trim() || undefined,
        timeSinceConnected: timeSinceConnected.trim() || undefined,
        timeHorizon: timeHorizon.trim() || undefined,
        knowledgeOfBusiness: knowledgeOfBusiness,
        myBusinessDescription: myBusinessDescription.trim() || undefined,
        desiredOutcome: desiredOutcome.trim() || undefined,
        ownerId: ownerId,
      });

      if (response.data?.success && response.data?.body) {
        // Navigate to template builder with generated data
        const params = new URLSearchParams({
          title: response.data.title || '',
          subject: response.data.subject || '',
          body: response.data.body || response.data.template || '',
        });
        if (companyHQId) {
          params.append('companyHQId', companyHQId);
        }
        
        router.push(`/builder/template/new?${params.toString()}`);
      } else {
        setError(response.data?.error || 'Failed to generate template');
        setGenerating(false);
      }
    } catch (err) {
      console.error('Error generating template:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate template');
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Relationship-Aware</h1>
            <p className="mt-1 text-sm text-gray-600">
              Provide relationship context and AI will generate a personalized template
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Relationship Type *
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                disabled={generating}
              >
                <option value="COLD">Cold - Don't know them well</option>
                <option value="WARM">Warm - Some connection</option>
                <option value="ESTABLISHED">Established - Regular contact</option>
                <option value="DORMANT">Dormant - Haven't talked in a while</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Type of Person *
              </label>
              <select
                value={typeOfPerson}
                onChange={(e) => setTypeOfPerson(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                disabled={generating}
              >
                <option value="CURRENT_CLIENT">Current Client</option>
                <option value="FORMER_CLIENT">Former Client</option>
                <option value="FORMER_COWORKER">Former Coworker</option>
                <option value="PROSPECT">Prospect</option>
                <option value="PARTNER">Partner</option>
                <option value="FRIEND_OF_FRIEND">Friend of Friend</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Why Reaching Out *
              </label>
              <textarea
                value={whyReachingOut}
                onChange={(e) => setWhyReachingOut(e.target.value)}
                placeholder="e.g., I'd like to explore potential collaboration opportunities..."
                rows={4}
                className="w-full rounded border border-gray-300 px-3 py-2"
                disabled={generating}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                What You Want From Them (Optional)
              </label>
              <input
                type="text"
                value={whatWantFromThem}
                onChange={(e) => setWhatWantFromThem(e.target.value)}
                placeholder="e.g., catch up, explore collaboration, get feedback"
                className="w-full rounded border border-gray-300 px-3 py-2"
                disabled={generating}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Time Since Connected (Optional)
              </label>
              <input
                type="text"
                value={timeSinceConnected}
                onChange={(e) => setTimeSinceConnected(e.target.value)}
                placeholder="e.g., a long time, 2 years, recently"
                className="w-full rounded border border-gray-300 px-3 py-2"
                disabled={generating}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Time Horizon (Optional)
              </label>
              <input
                type="text"
                value={timeHorizon}
                onChange={(e) => setTimeHorizon(e.target.value)}
                placeholder="e.g., 2026, next quarter, soon"
                className="w-full rounded border border-gray-300 px-3 py-2"
                disabled={generating}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="knowledgeOfBusiness"
                checked={knowledgeOfBusiness}
                onChange={(e) => setKnowledgeOfBusiness(e.target.checked)}
                className="rounded border-gray-300"
                disabled={generating}
              />
              <label htmlFor="knowledgeOfBusiness" className="text-sm text-gray-700">
                They already know about your business
              </label>
            </div>

            {!knowledgeOfBusiness && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Your Business Description (Optional)
                </label>
                <textarea
                  value={myBusinessDescription}
                  onChange={(e) => setMyBusinessDescription(e.target.value)}
                  placeholder="Describe your business briefly"
                  rows={2}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  disabled={generating}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Desired Outcome (Optional)
              </label>
              <input
                type="text"
                value={desiredOutcome}
                onChange={(e) => setDesiredOutcome(e.target.value)}
                placeholder="e.g., see if we can collaborate, get their input"
                className="w-full rounded border border-gray-300 px-3 py-2"
                disabled={generating}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={generating}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating || !whyReachingOut.trim()}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate Template'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RelationshipAwareTemplatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <RelationshipAwareTemplateContent />
    </Suspense>
  );
}


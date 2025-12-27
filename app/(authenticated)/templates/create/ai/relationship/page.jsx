'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useOwner } from '@/hooks/useOwner';

/**
 * Relationship-Aware AI Template Page
 * TODO: Implement relationship helper form and AI generation
 */
export default function RelationshipAwareTemplatePage() {
  const router = useRouter();
  const { ownerId } = useOwner();
  const [relationship, setRelationship] = useState('WARM');
  const [whyReachingOut, setWhyReachingOut] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!whyReachingOut.trim()) {
      setError('Please explain why you\'re reaching out');
      return;
    }

    if (!ownerId) {
      setError('Owner not found. Please refresh the page.');
      return;
    }

    // TODO: Implement AI generation with relationship context
    // For now, redirect to manual template builder
    router.push(`/builder/template/new`);
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Relationship Type *
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="COLD">Cold - Don't know them well</option>
                <option value="WARM">Warm - Some connection</option>
                <option value="ESTABLISHED">Established - Regular contact</option>
                <option value="DORMANT">Dormant - Haven't talked in a while</option>
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
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={handleGenerate}
                disabled={generating || !whyReachingOut.trim()}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useOwner } from '@/hooks/useOwner';

/**
 * Quick Idea AI Template Page
 * TODO: Implement AI generation from free-text idea
 */
export default function QuickIdeaTemplatePage() {
  const router = useRouter();
  const { ownerId } = useOwner();
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('Please enter an idea');
      return;
    }

    if (!ownerId) {
      setError('Owner not found. Please refresh the page.');
      return;
    }

    // TODO: Implement AI generation
    // For now, redirect to manual template builder with the idea as a note
    router.push(`/builder/template/new?idea=${encodeURIComponent(idea)}`);
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
            <h1 className="text-3xl font-bold text-gray-900">AI Quick Idea</h1>
            <p className="mt-1 text-sm text-gray-600">
              Describe your idea and AI will generate a template
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
                Your Idea *
              </label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g., I want to reach out to my old coworker Sarah who just started at TechCorp. I'd like to see if we can collaborate on some projects."
                rows={6}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={handleGenerate}
                disabled={generating || !idea.trim()}
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


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

/**
 * Quick Idea AI Template Page
 * User enters an idea, AI generates template, then navigates to template builder
 */
export default function QuickIdeaTemplatePage() {
  const router = useRouter();
  const { ownerId } = useOwner();
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!idea.trim()) {
      setError('Please enter an idea');
      return;
    }

    if (!ownerId) {
      setError('Owner not found. Please refresh the page.');
      return;
    }

    try {
      setGenerating(true);
      setError('');

      // Call the generate-quick endpoint with ownerId for signature
      const response = await api.post('/api/template/generate-quick', {
        idea: idea.trim(),
        ownerId: ownerId,
      });

      if (response.data?.success && response.data?.template) {
        // Navigate to template builder with generated data
        // The generate-quick endpoint returns: { success: true, template, subject, inferred, variables }
        const templateBody = response.data.template || '';
        const subject = response.data.subject || 'Hi {{firstName}},';
        const inferred = response.data.inferred || {};
        
        // Generate title from inferred data
        const title = inferred.ask 
          ? `Quick Note: ${inferred.ask}`
          : 'AI Generated Template';
        
        // Create params for template builder - URL encode properly
        const params = new URLSearchParams({
          title: title,
          subject: subject,
          body: templateBody,
        });
        
        // Navigate to template builder - use full path
        const url = `/builder/template/new?${params.toString()}`;
        console.log('Navigating to:', url);
        router.push(url);
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
          <form onSubmit={handleGenerate} className="space-y-4">
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
                disabled={generating}
              />
            </div>

            <div className="flex justify-end gap-4">
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
                disabled={generating || !idea.trim()}
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

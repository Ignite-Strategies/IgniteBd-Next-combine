'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function AIPresentationBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const presentationId = params.id;

  const [presentationIdea, setPresentationIdea] = useState('');
  const [slideCount, setSlideCount] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [presentation, setPresentation] = useState(null);

  useEffect(() => {
    if (presentationId) {
      loadPresentation();
    }
  }, [presentationId]);

  const loadPresentation = async () => {
    try {
      const response = await api.get(`/api/content/presentations/${presentationId}`);
      if (response.data?.success) {
        const pres = response.data.presentation;
        setPresentation(pres);
        setSlideCount(pres.slides?.length || 6);
      }
    } catch (err) {
      console.error('Error loading presentation:', err);
      setError('Failed to load presentation');
    }
  };

  const handleGenerate = async () => {
    if (!presentationIdea.trim()) {
      setError('Please enter a presentation idea');
      return;
    }

    setError('');
    setGenerating(true);

    try {
      // Call AI API to generate outline
      const response = await api.post('/api/content/presentations/generate-outline', {
        presentationIdea,
        slideCount,
      });

      if (!response.data?.success || !response.data?.outline) {
        throw new Error(response.data?.error || 'Failed to generate outline');
      }

      const outline = response.data.outline;

      // Update existing presentation with AI-generated outline
      const updateResponse = await api.patch(`/api/content/presentations/${presentationId}`, {
        title: outline.title || presentation?.title,
        description: outline.description || presentation?.description,
        slides: outline.slides,
      });

      if (updateResponse.data?.success) {
        router.push(`/content/presentations/${presentationId}`);
      } else {
        throw new Error('Failed to update presentation');
      }
    } catch (err) {
      console.error('Error generating outline:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate outline. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="AI Presentation Builder"
          subtitle={presentation ? `Enhance: ${presentation.title}` : 'Generate a presentation outline from your idea'}
          backTo={`/content/presentations/${presentationId}`}
          backLabel="Back to Presentation"
        />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                What is your presentation idea?
              </label>
              <textarea
                value={presentationIdea}
                onChange={(e) => setPresentationIdea(e.target.value)}
                placeholder="Describe your presentation idea or what you want to add..."
                rows={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                How many slides?
              </label>
              <input
                type="number"
                value={slideCount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    return;
                  }
                  const numValue = parseInt(value, 10);
                  if (!isNaN(numValue)) {
                    if (numValue < 1) {
                      setSlideCount(1);
                    } else if (numValue > 100) {
                      setSlideCount(100);
                    } else {
                      setSlideCount(numValue);
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (isNaN(value) || value < 1) {
                    setSlideCount(6);
                  } else if (value > 100) {
                    setSlideCount(100);
                  } else {
                    setSlideCount(value);
                  }
                }}
                min={1}
                max={100}
                step={1}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating || !presentationIdea.trim()}
                className="rounded bg-red-600 px-6 py-3 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate Outline with AI'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

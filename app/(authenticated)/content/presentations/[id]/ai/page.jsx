'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Trash2 } from 'lucide-react';
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
  const [generatedOutline, setGeneratedOutline] = useState(null); // Store generated outline for preview
  const [saving, setSaving] = useState(false);

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
    setGeneratedOutline(null);

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
      
      // Convert slides array format to sections format for preview
      let convertedOutline = { ...outline };
      if (outline.slides && Array.isArray(outline.slides)) {
        convertedOutline.slides = {
          sections: outline.slides.map((slide) => ({
            title: slide.title || '',
            bullets: slide.content 
              ? (typeof slide.content === 'string' 
                  ? slide.content.split('\n').filter(b => b.trim()).map(b => b.replace(/^[•\-\*]\s*/, '').trim())
                  : [slide.content])
              : (slide.bullets || []),
            notes: slide.notes || null,
          })),
        };
      }
      
      // Store generated outline for preview/edit
      setGeneratedOutline(convertedOutline);
    } catch (err) {
      console.error('Error generating outline:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate outline. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedOutline) return;

    setSaving(true);
    setError('');

    try {
      // Ensure slides structure is correct
      let slidesToSave = generatedOutline.slides;
      if (!slidesToSave || !slidesToSave.sections) {
        // Convert array format to sections format if needed
        if (Array.isArray(slidesToSave)) {
          slidesToSave = {
            sections: slidesToSave.map((slide, idx) => ({
              title: slide.title || `Slide ${idx + 1}`,
              bullets: slide.content ? [slide.content] : (slide.bullets || []),
            })),
          };
        } else {
          slidesToSave = { sections: [] };
        }
      }

      // Update existing presentation with AI-generated outline
      const updateResponse = await api.patch(`/api/content/presentations/${presentationId}`, {
        title: generatedOutline.title || presentation?.title || 'Untitled Presentation',
        description: generatedOutline.description || presentation?.description,
        slides: slidesToSave,
      });

      if (updateResponse.data?.success) {
        router.push(`/content/presentations/${presentationId}`);
      } else {
        throw new Error('Failed to update presentation');
      }
    } catch (err) {
      console.error('Error saving outline:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save presentation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSlideTitle = (index, title) => {
    if (!generatedOutline?.slides?.sections) return;
    const updated = { ...generatedOutline };
    if (!updated.slides.sections[index]) return;
    updated.slides.sections[index] = { ...updated.slides.sections[index], title };
    setGeneratedOutline(updated);
  };

  const updateSlideBullet = (slideIndex, bulletIndex, value) => {
    if (!generatedOutline?.slides?.sections) return;
    const updated = { ...generatedOutline };
    if (!updated.slides.sections[slideIndex]?.bullets) return;
    updated.slides.sections[slideIndex].bullets[bulletIndex] = value;
    setGeneratedOutline(updated);
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
                What is your presentation about?
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Describe what you want to present - the AI will create the title, outline, and slide content
              </p>
              <textarea
                value={presentationIdea}
                onChange={(e) => setPresentationIdea(e.target.value)}
                placeholder="Example: A pitch deck for our new SaaS product targeting mid-market companies, focusing on ROI and ease of implementation..."
                rows={6}
                spellCheck={true}
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

            {!generatedOutline && (
              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !presentationIdea.trim()}
                  className="flex items-center gap-2 rounded bg-red-600 px-6 py-3 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {generating ? 'Generating with AI...' : 'Generate Outline with AI'}
                </button>
              </div>
            )}

            {/* Show generated outline for preview/edit */}
            {generatedOutline && (
              <div className="space-y-6 border-t border-gray-200 pt-6">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <h3 className="text-sm font-semibold text-green-900 mb-1">✅ AI Generated Outline</h3>
                  <p className="text-xs text-green-700">Review and edit the generated content below, then save to apply it to your presentation.</p>
                </div>

                {/* Title Preview */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Presentation Title
                  </label>
                  <input
                    type="text"
                    value={generatedOutline.title || ''}
                    onChange={(e) => setGeneratedOutline({ ...generatedOutline, title: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>

                {/* Description Preview */}
                {generatedOutline.description && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={generatedOutline.description}
                      onChange={(e) => setGeneratedOutline({ ...generatedOutline, description: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                )}

                {/* Slides Preview/Edit */}
                {generatedOutline.slides?.sections && generatedOutline.slides.sections.length > 0 && (
                  <div>
                    <label className="mb-4 block text-sm font-semibold text-gray-700">
                      Slides ({generatedOutline.slides.sections.length})
                    </label>
                    <div className="space-y-4">
                      {generatedOutline.slides.sections.map((section, slideIndex) => (
                        <div key={slideIndex} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <div className="mb-3">
                            <label className="mb-1 block text-xs font-semibold text-gray-600">
                              Slide {slideIndex + 1} Title
                            </label>
                            <input
                              type="text"
                              value={section.title || ''}
                              onChange={(e) => updateSlideTitle(slideIndex, e.target.value)}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-gray-600">
                              Content
                            </label>
                            {section.bullets && section.bullets.length > 0 ? (
                              <div className="space-y-2">
                                {section.bullets.map((bullet, bulletIndex) => (
                                  <div key={bulletIndex} className="flex items-start gap-2">
                                    <span className="mt-2 text-gray-400">•</span>
                                    <textarea
                                      value={bullet}
                                      onChange={(e) => updateSlideBullet(slideIndex, bulletIndex, e.target.value)}
                                      rows={2}
                                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 italic">No content generated for this slide</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                  <button
                    onClick={() => {
                      setGeneratedOutline(null);
                      setError('');
                    }}
                    className="rounded border border-gray-300 px-6 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Generate Again
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save & Apply to Presentation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

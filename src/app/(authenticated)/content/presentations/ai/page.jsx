'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';

export default function AIPresentationBuilderPage() {
  const router = useRouter();
  const [presentationIdea, setPresentationIdea] = useState('');
  const [slideCount, setSlideCount] = useState(6);
  const [title, setTitle] = useState('');
  const [presenter, setPresenter] = useState('');
  const [presenterExpertise, setPresenterExpertise] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generatedOutline, setGeneratedOutline] = useState(null);
  const [redisKey, setRedisKey] = useState(null);

  // Load temp data from localStorage if coming from create page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tempData = localStorage.getItem('temp_presentation_data');
      if (tempData) {
        try {
          const parsed = JSON.parse(tempData);
          setPresentationIdea(parsed.description || '');
          setTitle(parsed.title || '');
          setSlideCount(parsed.slideCount || 6);
          // Clear temp data after loading
          localStorage.removeItem('temp_presentation_data');
        } catch (e) {
          console.warn('Failed to parse temp presentation data:', e);
        }
      }
    }
  }, []);

  const handleGenerate = async () => {
    if (!presentationIdea.trim()) {
      setError('Please enter a presentation idea');
      return;
    }

    setError('');
    setGenerating(true);
    setGeneratedOutline(null);
    setRedisKey(null);

    try {
      // Call AI API to generate outline
      const response = await api.post('/api/content/presentations/generate-outline', {
        presentationIdea,
        slideCount,
        presenter: presenter.trim() || null,
        presenterExpertise: presenterExpertise.trim() || null,
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

      // Store in Redis via API
      const storeResponse = await api.post('/api/content/presentations/store-outline', {
        outline: convertedOutline,
        title: title || convertedOutline.title,
        description: presentationIdea,
      });

      if (storeResponse.data?.success && storeResponse.data?.redisKey) {
        setRedisKey(storeResponse.data.redisKey);
        setGeneratedOutline(convertedOutline);
        if (!title && convertedOutline.title) {
          setTitle(convertedOutline.title);
        }
      } else {
        // Fallback: store in state only (no Redis)
        console.warn('Failed to store in Redis, using local state only');
        setGeneratedOutline(convertedOutline);
        if (!title && convertedOutline.title) {
          setTitle(convertedOutline.title);
        }
      }
    } catch (err) {
      console.error('Error generating outline:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate outline. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedOutline) return;

    const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    
    if (!companyHQId) {
      setError('Missing company context. Please complete onboarding first.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Ensure slides structure matches Prisma schema: { sections: [{ title: string, bullets: string[] }] }
      let slidesToSave = null;
      
      if (generatedOutline.slides) {
        // Check if it's already in sections format
        if (generatedOutline.slides.sections && Array.isArray(generatedOutline.slides.sections)) {
          // Already in correct format, just ensure bullets are arrays
          slidesToSave = {
            sections: generatedOutline.slides.sections.map((section) => ({
              title: section.title || '',
              bullets: Array.isArray(section.bullets) 
                ? section.bullets.filter(b => b && b.trim()) // Remove empty bullets
                : (section.bullets ? [section.bullets] : []),
            })),
          };
        } else if (Array.isArray(generatedOutline.slides)) {
          // Convert from array format to sections format
          slidesToSave = {
            sections: generatedOutline.slides.map((slide) => ({
              title: slide.title || '',
              bullets: slide.content 
                ? (typeof slide.content === 'string' 
                    ? slide.content.split('\n').filter(b => b.trim()).map(b => b.replace(/^[•\-\*]\s*/, '').trim())
                    : (Array.isArray(slide.content) ? slide.content : [slide.content]))
                : (Array.isArray(slide.bullets) ? slide.bullets : (slide.bullets ? [slide.bullets] : [])),
            })),
          };
        } else {
          // Fallback: empty sections
          slidesToSave = { sections: [] };
        }
      } else {
        // No slides, use empty structure
        slidesToSave = { sections: [] };
      }

      // Double-check: ensure we have the right shape
      if (!slidesToSave || typeof slidesToSave !== 'object' || !slidesToSave.sections || !Array.isArray(slidesToSave.sections)) {
        throw new Error('Invalid slides format - expected { sections: [...] }');
      }

      const finalTitle = title.trim() || generatedOutline.title || 'Untitled Presentation';
      const finalDescription = generatedOutline.description || presentationIdea || null;

      console.log('💾 Saving presentation with:', {
        companyHQId,
        title: finalTitle,
        description: finalDescription,
        slidesStructure: {
          sectionsCount: slidesToSave.sections.length,
          firstSection: slidesToSave.sections[0],
        },
      });

      // Create presentation with AI-generated outline
      const createResponse = await api.post('/api/content/presentations', {
        companyHQId,
        title: finalTitle,
        presenter: presenter.trim() || null,
        description: finalDescription,
        slides: slidesToSave, // This is now { sections: [...] }
        published: false,
      });

      if (createResponse.data?.success && createResponse.data?.presentation) {
        console.log('✅ Presentation created successfully:', createResponse.data.presentation.id);
        
        // Clean up Redis key if stored
        if (redisKey) {
          try {
            await api.delete(`/api/content/presentations/outline/${redisKey}`);
          } catch (e) {
            console.warn('Failed to clean up Redis key:', e);
          }
        }
        
        router.push(`/content/presentations/${createResponse.data.presentation.id}`);
      } else {
        throw new Error('Failed to create presentation - no presentation returned');
      }
    } catch (err) {
      console.error('❌ Error saving presentation:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to save presentation. Please try again.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const updateSlideTitle = (index, newTitle) => {
    if (!generatedOutline?.slides?.sections) return;
    const updated = { ...generatedOutline };
    if (!updated.slides.sections[index]) return;
    updated.slides.sections[index] = { ...updated.slides.sections[index], title: newTitle };
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
          subtitle="Generate a presentation outline from your idea"
          backTo="/content/presentations"
          backLabel="Back to Presentations"
        />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!generatedOutline && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    What is your presentation about? *
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Number of Slides
                    </label>
                    <input
                      type="number"
                      value={slideCount}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value) && value >= 1 && value <= 100) {
                          setSlideCount(value);
                        }
                      }}
                      min={1}
                      max={100}
                      step={1}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Leave blank - AI will suggest one"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Presenter Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={presenter}
                      onChange={(e) => setPresenter(e.target.value)}
                      placeholder="e.g., John Smith, Sarah Johnson"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Who will be presenting? Helps AI tailor the content.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Presenter Expertise (Optional)
                    </label>
                    <input
                      type="text"
                      value={presenterExpertise}
                      onChange={(e) => setPresenterExpertise(e.target.value)}
                      placeholder="e.g., 10 years in SaaS sales, Legal expert, Marketing director"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Their background/expertise helps AI customize the content.
                    </p>
                  </div>
                </div>

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
              </>
            )}

            {/* Show generated outline for preview/edit */}
            {generatedOutline && (
              <div className="space-y-6 border-t border-gray-200 pt-6">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <h3 className="text-sm font-semibold text-green-900 mb-1">✅ AI Generated Outline</h3>
                  <p className="text-xs text-green-700">Review and edit the generated content below, then save to create your presentation.</p>
                </div>

                {/* Title Preview */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Presentation Title
                  </label>
                  <input
                    type="text"
                    value={title || generatedOutline.title || ''}
                    onChange={(e) => setTitle(e.target.value)}
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
                      setRedisKey(null);
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
                    {saving ? 'Creating Presentation...' : 'Save & Create Presentation'}
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

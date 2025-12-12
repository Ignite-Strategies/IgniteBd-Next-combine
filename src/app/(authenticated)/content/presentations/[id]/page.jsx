'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Save, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function PresentationPage() {
  const params = useParams();
  const router = useRouter();
  const presentationId = params.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slides, setSlides] = useState([]);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gammaStatus, setGammaStatus] = useState(null);
  const [gammaDeckUrl, setGammaDeckUrl] = useState(null);
  const [gammaPptxUrl, setGammaPptxUrl] = useState(null);
  const [buildingPPT, setBuildingPPT] = useState(false);

  useEffect(() => {
    if (presentationId) {
      loadPresentation();
    }
  }, [presentationId]);

  const loadPresentation = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/content/presentations/${presentationId}`);
      if (response.data?.success) {
        const presentation = response.data.presentation;
        setTitle(presentation.title || '');
        setDescription(presentation.description || '');
        
        // Handle slides format - could be { sections: [...] } or array or string
        let slidesData = [];
        if (presentation.slides) {
          if (typeof presentation.slides === 'string') {
            try {
              const parsed = JSON.parse(presentation.slides);
              if (parsed.sections && Array.isArray(parsed.sections)) {
                // Convert sections format to array format for editing
                slidesData = parsed.sections.map((section, idx) => ({
                  slideNumber: idx + 1,
                  title: section.title || '',
                  content: Array.isArray(section.bullets) ? section.bullets.join('\n') : (section.bullets || ''),
                }));
              } else if (Array.isArray(parsed)) {
                slidesData = parsed;
              }
            } catch (e) {
              console.warn('Failed to parse slides JSON:', e);
            }
          } else if (presentation.slides.sections && Array.isArray(presentation.slides.sections)) {
            // Convert sections format to array format for editing
            slidesData = presentation.slides.sections.map((section, idx) => ({
              slideNumber: idx + 1,
              title: section.title || '',
              content: Array.isArray(section.bullets) ? section.bullets.join('\n') : (section.bullets || ''),
            }));
          } else if (Array.isArray(presentation.slides)) {
            slidesData = presentation.slides;
          }
        }
        setSlides(slidesData);
        
        setPublished(presentation.published || false);
        setGammaStatus(presentation.gammaStatus || null);
        setGammaDeckUrl(presentation.gammaDeckUrl || null);
        setGammaPptxUrl(presentation.gammaPptxUrl || null);
      }
    } catch (err) {
      console.error('Error loading presentation:', err);
      setError('Failed to load presentation');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      // Convert slides array back to sections format for storage
      const slidesToSave = {
        sections: slides.map((slide, idx) => ({
          title: slide.title || `Slide ${idx + 1}`,
          bullets: slide.content ? slide.content.split('\n').filter(b => b.trim()) : [],
        })),
      };

      const response = await api.patch(`/api/content/presentations/${presentationId}`, {
        title,
        description,
        slides: slidesToSave,
        published,
      });

      if (response.data?.success) {
        const savedPresentation = response.data.presentation;
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
          if (companyHQId) {
            try {
              const cachedKey = `presentations_${companyHQId}`;
              const cached = localStorage.getItem(cachedKey);
              const presentations = cached ? JSON.parse(cached) : [];
              const existingIndex = presentations.findIndex(p => p.id === savedPresentation.id);
              if (existingIndex >= 0) {
                presentations[existingIndex] = savedPresentation;
              } else {
                presentations.unshift(savedPresentation);
              }
              localStorage.setItem(cachedKey, JSON.stringify(presentations));
              console.log('💾 Saved presentation to localStorage');
            } catch (e) {
              console.warn('Failed to save to localStorage:', e);
            }
          }
        }
        
        router.push('/content/presentations');
      } else {
        throw new Error('Failed to save presentation');
      }
    } catch (err) {
      console.error('Error saving presentation:', err);
      setError('Failed to save presentation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSlide = (index, field, value) => {
    const updated = [...slides];
    updated[index] = { ...updated[index], [field]: value };
    setSlides(updated);
  };

  const handleBuildPPT = async () => {
    if (!presentationId) return;
    
    setBuildingPPT(true);
    setError('');
    
    try {
      const response = await api.post('/api/decks/generate', {
        presentationId,
      });
      
      if (response.data?.success) {
        if (response.data.status === 'ready') {
          setGammaStatus('ready');
          setGammaDeckUrl(response.data.deckUrl);
          setGammaPptxUrl(response.data.pptxUrl);
          
          // Reload presentation to get updated status
          await loadPresentation();
        } else {
          setGammaStatus('generating');
        }
      } else {
        throw new Error(response.data?.error || 'Failed to generate PPT');
      }
    } catch (err) {
      console.error('Error building PPT:', err);
      setError(err.response?.data?.error || err.message || 'Failed to build PPT. Please try again.');
      setGammaStatus('error');
    } finally {
      setBuildingPPT(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading presentation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Edit Presentation"
          subtitle={title || 'Presentation'}
          backTo="/content/presentations"
          backLabel="Back to Presentations"
        />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                spellCheck={true}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                spellCheck={true}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  Slides ({slides.length})
                </label>
              </div>

              <div className="space-y-4">
                {slides.map((slide, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Slide {slide.slideNumber || index + 1}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={slide.title || ''}
                        onChange={(e) => updateSlide(index, 'title', e.target.value)}
                        placeholder="Slide title"
                        spellCheck={true}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={slide.content || ''}
                        onChange={(e) => updateSlide(index, 'content', e.target.value)}
                        placeholder="Slide content (key points, talking points, etc.)"
                        rows={3}
                        spellCheck={true}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="published" className="text-sm text-gray-700">
                Published (visible to client)
              </label>
            </div>

            {/* Gamma/PPT Status */}
            {(gammaStatus || gammaDeckUrl || gammaPptxUrl) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">PPT Status</h3>
                    {gammaStatus === 'ready' && (
                      <div className="space-y-2">
                        {gammaDeckUrl && (
                          <a
                            href={gammaDeckUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-700 hover:text-blue-900 underline"
                          >
                            View Deck
                          </a>
                        )}
                        {gammaPptxUrl && (
                          <a
                            href={gammaPptxUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-700 hover:text-blue-900 underline block"
                          >
                            Download PPTX
                          </a>
                        )}
                      </div>
                    )}
                    {gammaStatus === 'generating' && (
                      <p className="text-sm text-blue-700">Generating PPT...</p>
                    )}
                    {gammaStatus === 'error' && (
                      <p className="text-sm text-red-700">PPT generation failed</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={handleBuildPPT}
                disabled={buildingPPT || gammaStatus === 'generating' || !slides || slides.length === 0}
                className="flex items-center gap-2 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buildingPPT || gammaStatus === 'generating' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Building PPT...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Build the PPT
                  </>
                )}
              </button>
              
              <div className="flex gap-4">
                <button
                  onClick={() => router.push(`/content/presentations/${presentationId}/ai`)}
                  className="flex items-center gap-2 rounded border border-gray-300 bg-white px-6 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Enhance with AI
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Presentation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

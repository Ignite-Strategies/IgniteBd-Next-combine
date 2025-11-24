'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';

/**
 * Presentation Builder Page
 */
export default function PresentationBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const presentationId = params.presentationId;
  const isNew = presentationId === 'new';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slides, setSlides] = useState(null); // Store as object, not string
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isNew && presentationId) {
      loadPresentation();
    }
  }, [presentationId, isNew]);

  const loadPresentation = async () => {
    try {
      setLoading(true);
      // Always fetch fresh from database - never use localStorage for editing
      const response = await api.get(`/api/content/presentations/${presentationId}`);
      if (response.data?.success) {
        const presentation = response.data.presentation;
        console.log('📦 Loaded presentation from database:', presentation.id);
        
        setTitle(presentation.title || '');
        setDescription(presentation.description || '');
        
        // Handle slides - could be object, string, or null
        let slidesData = { sections: [] };
        if (presentation.slides) {
          if (typeof presentation.slides === 'string') {
            try {
              slidesData = JSON.parse(presentation.slides);
            } catch (e) {
              console.warn('Failed to parse slides JSON:', e);
            }
          } else if (typeof presentation.slides === 'object') {
            slidesData = presentation.slides;
          }
        }
        
        // Ensure sections array exists
        if (!slidesData.sections || !Array.isArray(slidesData.sections)) {
          slidesData.sections = [];
        }
        
        setSlides(slidesData);
        setPublished(presentation.published || false);
      } else {
        console.error('Failed to load presentation:', response.data);
        alert('Failed to load presentation');
      }
    } catch (err) {
      console.error('Error loading presentation:', err);
      alert('Failed to load presentation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      const data = {
        companyHQId,
        title,
        description,
        slides: slides || { sections: [] },
        published,
      };

      let presentation;
      if (isNew) {
        const response = await api.post('/api/content/presentations', data);
        presentation = response.data.presentation;
      } else {
        const response = await api.patch(`/api/content/presentations/${presentationId}`, data);
        presentation = response.data.presentation;
      }

      // Save to localStorage for frontend storage
      if (typeof window !== 'undefined') {
        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        const cachedKey = `presentations_${companyHQId}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          const presentations = cached ? JSON.parse(cached) : [];
          const existingIndex = presentations.findIndex(p => p.id === presentation.id);
          if (existingIndex >= 0) {
            presentations[existingIndex] = presentation;
          } else {
            presentations.unshift(presentation); // Add to beginning
          }
          localStorage.setItem(cachedKey, JSON.stringify(presentations));
          console.log('💾 Saved presentation to localStorage');
        } catch (e) {
          console.warn('Failed to save to localStorage:', e);
        }
      }

      // Show success message and redirect immediately
      setSaveSuccess(true);
      // Redirect to presentations home page immediately
      router.push('/content/presentations');
    } catch (err) {
      console.error('Error saving presentation:', err);
      alert('Failed to save presentation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew ? 'Create Presentation' : 'Edit Presentation'}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder=""
                rows={5}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Slides
              </label>
              {slides && slides.sections && slides.sections.length > 0 ? (
                <div className="space-y-4">
                  {slides.sections.map((section, slideIndex) => (
                    <div key={slideIndex} className="p-6 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Slide {slideIndex + 1} Title
                        </label>
                        <input
                          type="text"
                          value={section.title || ''}
                          onChange={(e) => {
                            const updated = { ...slides };
                            updated.sections[slideIndex].title = e.target.value;
                            setSlides(updated);
                          }}
                          placeholder="Slide title"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Bullet Points
                        </label>
                        <div className="space-y-2">
                          {section.bullets && section.bullets.map((bullet, bulletIndex) => (
                            <div key={bulletIndex} className="flex items-center gap-2">
                              <span className="text-gray-400">•</span>
                              <input
                                type="text"
                                value={bullet}
                                onChange={(e) => {
                                  const updated = { ...slides };
                                  updated.sections[slideIndex].bullets[bulletIndex] = e.target.value;
                                  setSlides(updated);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                                placeholder="Bullet point"
                              />
                              <button
                                onClick={() => {
                                  const updated = { ...slides };
                                  updated.sections[slideIndex].bullets.splice(bulletIndex, 1);
                                  setSlides(updated);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const updated = { ...slides };
                              if (!updated.sections[slideIndex].bullets) {
                                updated.sections[slideIndex].bullets = [];
                              }
                              updated.sections[slideIndex].bullets.push('');
                              setSlides(updated);
                            }}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mt-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add Bullet Point
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-sm text-gray-500">
                  No slides yet. Use the AI builder or create slides manually.
                </div>
              )}
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

            <div className="flex items-center justify-end gap-4">
              {saveSuccess && (
                <div className="flex items-center gap-2 rounded bg-green-100 px-4 py-2 text-green-800">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-semibold">Saved successfully!</span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving || saveSuccess}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


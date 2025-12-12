'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Save, ArrowLeft } from 'lucide-react';
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
        setSlides(presentation.slides || []);
        setPublished(presentation.published || false);
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
      const response = await api.patch(`/api/content/presentations/${presentationId}`, {
        title,
        description,
        slides,
        published,
      });

      if (response.data?.success) {
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
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={slide.content || ''}
                        onChange={(e) => updateSlide(index, 'content', e.target.value)}
                        placeholder="Slide content (key points, talking points, etc.)"
                        rows={3}
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

            <div className="flex justify-end gap-4">
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
  );
}

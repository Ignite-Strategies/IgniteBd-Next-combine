'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
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
  const [presenter, setPresenter] = useState('');
  const [description, setDescription] = useState('');
  const [slides, setSlides] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && presentationId) {
      loadPresentation();
    }
  }, [presentationId, isNew]);

  const loadPresentation = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/content/presentations/${presentationId}`);
      if (response.data?.success) {
        const presentation = response.data.presentation;
        setTitle(presentation.title || '');
        setPresenter(presentation.presenter || '');
        setDescription(presentation.description || '');
        setSlides(typeof presentation.slides === 'object' 
          ? JSON.stringify(presentation.slides, null, 2) 
          : presentation.slides || '');
        setPublished(presentation.published || false);
      }
    } catch (err) {
      console.error('Error loading presentation:', err);
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

      // Parse slides if it's a JSON string
      let parsedSlides = slides;
      if (typeof slides === 'string' && slides.trim()) {
        try {
          parsedSlides = JSON.parse(slides);
        } catch (e) {
          // If not valid JSON, keep as string or set to null
          parsedSlides = slides.trim() || null;
        }
      }

      const data = {
        companyHQId,
        title,
        presenter,
        description,
        slides: parsedSlides,
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

      router.push(`/builder/presentation/${presentation.id}`);
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
                Presenter
              </label>
              <input
                type="text"
                value={presenter}
                onChange={(e) => setPresenter(e.target.value)}
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
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Slides (JSON)
              </label>
              <textarea
                value={slides}
                onChange={(e) => setSlides(e.target.value)}
                placeholder="JSON object with sections array"
                rows={10}
                className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              />
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
                onClick={handleSave}
                disabled={saving}
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


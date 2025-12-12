'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function CreatePresentationPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const companyHQId = typeof window !== 'undefined'
    ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
    : '';

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!companyHQId) {
      setError('Missing company context. Please complete onboarding first.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      // Create empty slides array
      const slides = Array.from({ length: slideCount }, (_, i) => ({
        slideNumber: i + 1,
        title: '',
        content: '',
        notes: null,
      }));

      const response = await api.post('/api/content/presentations', {
        companyHQId,
        title,
        description,
        slides,
        published: false,
      });

      if (response.data?.success && response.data?.presentation) {
        router.push(`/content/presentations/${response.data.presentation.id}`);
      } else {
        throw new Error('Failed to create presentation');
      }
    } catch (err) {
      console.error('Error creating presentation:', err);
      setError('Failed to create presentation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Presentation"
          subtitle="Create a new presentation deck"
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

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Presentation title"
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
                placeholder="Brief description of the presentation"
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

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
              <p className="mt-1 text-xs text-gray-500">
                You can add or remove slides later
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded border border-gray-300 px-6 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="rounded bg-red-600 px-6 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Presentation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

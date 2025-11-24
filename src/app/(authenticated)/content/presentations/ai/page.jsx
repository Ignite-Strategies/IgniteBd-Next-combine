'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { Sparkles, Save, Plus, Trash2 } from 'lucide-react';

export default function PresentationsAIPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [slideCount, setSlideCount] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [outline, setOutline] = useState(null);
  const [aiTitle, setAiTitle] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleGenerateOutline = async () => {
    if (!idea.trim()) {
      alert('Please enter a presentation idea');
      return;
    }

    try {
      setGenerating(true);
      const response = await api.post('/api/workme/presentations/outline-ai', {
        idea: idea.trim(),
        slideCount,
      });

      if (response.data?.success && response.data?.outline) {
        setOutline(response.data.outline);
        setAiTitle(response.data.title || 'Untitled Presentation');
        setAiDescription(response.data.description || '');
      } else {
        throw new Error('Failed to generate outline');
      }
    } catch (err) {
      console.error('Error generating outline:', err);
      alert('Failed to generate outline. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleOutlineChange = (index, field, value) => {
    const updated = [...outline];
    if (field === 'title') {
      updated[index].title = value;
    } else if (field === 'bullets') {
      updated[index].bullets = value.split('\n').filter(b => b.trim());
    }
    setOutline(updated);
  };

  const handleAddBullet = (index) => {
    const updated = [...outline];
    updated[index].bullets.push('');
    setOutline(updated);
  };

  const handleRemoveBullet = (slideIndex, bulletIndex) => {
    const updated = [...outline];
    updated[slideIndex].bullets.splice(bulletIndex, 1);
    setOutline(updated);
  };

  const handleBulletChange = (slideIndex, bulletIndex, value) => {
    const updated = [...outline];
    updated[slideIndex].bullets[bulletIndex] = value;
    setOutline(updated);
  };

  const handleSaveAndCreate = async () => {
    if (!outline || outline.length === 0) {
      alert('Please generate an outline first');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      if (!companyHQId) {
        alert('Company ID not found. Please refresh the page.');
        return;
      }

      // Create presentation with AI-generated outline, title, and description
      const response = await api.post('/api/content/presentations', {
        companyHQId,
        title: aiTitle || 'Untitled Presentation',
        description: aiDescription || '',
        slides: {
          sections: outline,
        },
        published: false,
      });

      if (response.data?.success && response.data?.presentation) {
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const cachedKey = `presentations_${companyHQId}`;
          try {
            const cached = localStorage.getItem(cachedKey);
            const presentations = cached ? JSON.parse(cached) : [];
            presentations.unshift(response.data.presentation);
            localStorage.setItem(cachedKey, JSON.stringify(presentations));
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
          }
        }
        // Redirect to home page
        router.push('/content/presentations');
      } else {
        throw new Error('Failed to create presentation');
      }
    } catch (err) {
      console.error('Error creating presentation:', err);
      alert('Failed to create presentation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="AI Presentation Builder"
          subtitle="Generate a presentation outline from your idea"
          backTo="/content/presentations/build"
          backLabel="Back to Build Options"
        />

        {!outline ? (
          /* Idea Input Form */
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What is your presentation idea?
                </label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="E.g., 'How to build better client relationships' or 'Effective meeting strategies for business development'"
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  How many slides?
                </label>
                <input
                  type="number"
                  value={slideCount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setSlideCount(6);
                    } else {
                      const num = parseInt(value, 10);
                      if (!isNaN(num) && num >= 3 && num <= 20) {
                        setSlideCount(num);
                      }
                    }
                  }}
                  min={3}
                  max={20}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                />
              </div>

              <button
                onClick={handleGenerateOutline}
                disabled={generating || !idea.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Generating Outline...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate Outline with AI
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Outline Editor */
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Your Presentation</h2>
              
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Presentation Title
                  </label>
                  <input
                    type="text"
                    value={aiTitle}
                    onChange={(e) => setAiTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                    placeholder="Presentation title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                    placeholder="Brief description of the presentation"
                  />
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-4">Slide Outline</h3>
              
              <div className="space-y-6">
                {outline.map((slide, slideIndex) => (
                  <div key={slideIndex} className="p-6 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Slide {slideIndex + 1} Title
                      </label>
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => handleOutlineChange(slideIndex, 'title', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                        placeholder="Slide title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Bullet Points
                      </label>
                      <div className="space-y-2">
                        {slide.bullets.map((bullet, bulletIndex) => (
                          <div key={bulletIndex} className="flex items-center gap-2">
                            <span className="text-gray-400">•</span>
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => handleBulletChange(slideIndex, bulletIndex, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                              placeholder="Bullet point"
                            />
                            <button
                              onClick={() => handleRemoveBullet(slideIndex, bulletIndex)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleAddBullet(slideIndex)}
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
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveAndCreate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Save & Create Presentation
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


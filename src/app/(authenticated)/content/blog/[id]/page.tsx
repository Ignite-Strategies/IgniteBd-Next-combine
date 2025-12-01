'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, ArrowLeft, Trash2, Plus } from 'lucide-react';
import api from '@/lib/api';
import type { BlogDraft } from '@/lib/blog-engine/types';

export default function BlogEditorPage() {
  const params = useParams();
  const router = useRouter();
  const blogId = params.id;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [blogDraft, setBlogDraft] = useState<BlogDraft | null>(null);
  const [summary, setSummary] = useState('');
  const [cta, setCta] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (blogId) {
      loadBlog();
    }
  }, [blogId]);

  const loadBlog = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/content/blog/${blogId}`);
      if (response.data?.success) {
        const blog = response.data.blog;
        console.log('📦 Loaded blog from database:', blog.id);
        
        setTitle(blog.title || '');
        setSubtitle(blog.subtitle || '');
        
        // Handle content as BlogDraft structure
        if (blog.content && typeof blog.content === 'object') {
          const draft = blog.content as BlogDraft;
          setBlogDraft(draft);
          setSummary(draft.summary || '');
          setCta(draft.cta || '');
        } else {
          // Initialize empty BlogDraft if no content
          setBlogDraft({
            title: blog.title || '',
            subtitle: blog.subtitle,
            outline: { sections: [] },
            body: { sections: [] },
          });
        }
      } else {
        console.error('Failed to load blog:', response.data);
        alert('Failed to load blog');
      }
    } catch (err) {
      console.error('Error loading blog:', err);
      alert('Failed to load blog. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    if (!blogDraft) {
      alert('Blog content is required');
      return;
    }

    try {
      setSaving(true);
      
      // Update BlogDraft with current values
      const updatedDraft: BlogDraft = {
        ...blogDraft,
        title,
        subtitle: subtitle || undefined,
        summary: summary || undefined,
        cta: cta || undefined,
      };

      const response = await api.patch(`/api/content/blog/${blogId}`, {
        title,
        subtitle,
        content: updatedDraft, // Store full BlogDraft structure
      });

      if (response.data?.success) {
        const blog = response.data.blog;
        
        // Update localStorage
        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        if (companyHQId) {
          const cachedKey = `blogs_${companyHQId}`;
          try {
            const cached = localStorage.getItem(cachedKey);
            const blogs = cached ? JSON.parse(cached) : [];
            const existingIndex = blogs.findIndex((b: any) => b.id === blog.id);
            if (existingIndex >= 0) {
              blogs[existingIndex] = blog;
            } else {
              blogs.unshift(blog);
            }
            localStorage.setItem(cachedKey, JSON.stringify(blogs));
            console.log('💾 Saved blog to localStorage');
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
          }
        }

        setSaveSuccess(true);
        setTimeout(() => {
          router.push('/content/blog');
        }, 1000);
      } else {
        throw new Error('Failed to save blog');
      }
    } catch (err) {
      console.error('Error saving blog:', err);
      alert('Failed to save blog');
    } finally {
      setSaving(false);
    }
  };

  const updateSectionHeading = (sectionIndex: number, newHeading: string) => {
    if (!blogDraft) return;
    const updated = { ...blogDraft };
    if (updated.body.sections[sectionIndex]) {
      updated.body.sections[sectionIndex].heading = newHeading;
      // Also update outline if it exists
      if (updated.outline.sections[sectionIndex]) {
        updated.outline.sections[sectionIndex].heading = newHeading;
      }
    }
    setBlogDraft(updated);
  };

  const updateSectionContent = (sectionIndex: number, newContent: string) => {
    if (!blogDraft) return;
    const updated = { ...blogDraft };
    if (updated.body.sections[sectionIndex]) {
      updated.body.sections[sectionIndex].content = newContent;
    }
    setBlogDraft(updated);
  };

  const updateOutlineBullets = (sectionIndex: number, bullets: string[]) => {
    if (!blogDraft) return;
    const updated = { ...blogDraft };
    if (updated.outline.sections[sectionIndex]) {
      updated.outline.sections[sectionIndex].bullets = bullets;
    }
    setBlogDraft(updated);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this blog? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/content/blog/${blogId}`);
      if (response.data?.success) {
        // Remove from localStorage
        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        if (companyHQId) {
          const cachedKey = `blogs_${companyHQId}`;
          try {
            const cached = localStorage.getItem(cachedKey);
            if (cached) {
              const blogs = JSON.parse(cached);
              const updated = blogs.filter(b => b.id !== blogId);
              localStorage.setItem(cachedKey, JSON.stringify(updated));
            }
          } catch (e) {
            console.warn('Failed to update localStorage:', e);
          }
        }
        router.push('/content/blog');
      } else {
        throw new Error('Failed to delete blog');
      }
    } catch (err) {
      console.error('Error deleting blog:', err);
      alert('Failed to delete blog');
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
            onClick={() => router.push('/content/blog')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Blog</h1>
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
                placeholder="Blog title"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Subtitle
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Blog subtitle"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            {/* Blog Sections */}
            {blogDraft && blogDraft.body.sections && blogDraft.body.sections.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Sections</h3>
                {blogDraft.body.sections.map((section, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Section {index + 1} Heading
                      </label>
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) => updateSectionHeading(index, e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Content
                      </label>
                      <textarea
                        value={section.content}
                        onChange={(e) => updateSectionContent(index, e.target.value)}
                        rows={6}
                        className="w-full rounded border border-gray-300 px-3 py-2"
                        placeholder="2-3 rich paragraphs for this section..."
                      />
                    </div>
                    {blogDraft.outline.sections[index] && (
                      <div className="mt-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Outline Bullets
                        </label>
                        <div className="space-y-2">
                          {blogDraft.outline.sections[index].bullets.map((bullet, bulletIndex) => (
                            <input
                              key={bulletIndex}
                              type="text"
                              value={bullet}
                              onChange={(e) => {
                                const newBullets = [...blogDraft.outline.sections[index].bullets];
                                newBullets[bulletIndex] = e.target.value;
                                updateOutlineBullets(index, newBullets);
                              }}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                              placeholder="Bullet point"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Summary
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Blog summary"
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Call to Action (CTA)
              </label>
              <textarea
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Call to action relating to BusinessPoint Law"
                rows={2}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              
              <div className="flex items-center gap-4">
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
    </div>
  );
}


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { Sparkles } from 'lucide-react';
import type { BlogDraft } from '@/lib/blog-engine/types';

export default function BlogBuildIdeaPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generatedBlogDraft, setGeneratedBlogDraft] = useState<BlogDraft | null>(null);
  const [redisKey, setRedisKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('Please enter an idea first');
      return;
    }

    setError('');
    setGenerating(true);
    setGeneratedBlogDraft(null);
    setRedisKey(null);

    try {
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        setError('Company ID not found. Please refresh and try again.');
        return;
      }
      
      // Call AI route to generate blog from idea
      const aiResponse = await api.post('/api/workme/blog/ai', {
        blogIngest: {
          mode: 'idea',
          idea: idea.trim(),
          companyHQId,
          targetLength: 500, // Required: 500 words for idea mode
        },
      });

      if (aiResponse.data?.success) {
        const blogDraft = aiResponse.data.blogDraft;
        
        // Store in Redis via API (prevents race conditions)
        const storeResponse = await api.post('/api/content/blog/store-draft', {
          blogDraft,
          title: blogDraft.title,
          subtitle: blogDraft.subtitle,
        });

        if (storeResponse.data?.success && storeResponse.data?.redisKey) {
          setRedisKey(storeResponse.data.redisKey);
          setGeneratedBlogDraft(blogDraft);
          setTitle(blogDraft.title || '');
          setSubtitle(blogDraft.subtitle || '');
        } else {
          // Fallback: store in state only (no Redis)
          console.warn('Failed to store in Redis, using local state only');
          setGeneratedBlogDraft(blogDraft);
          setTitle(blogDraft.title || '');
          setSubtitle(blogDraft.subtitle || '');
        }
      } else {
        throw new Error(aiResponse.data?.error || 'Failed to generate blog');
      }
    } catch (err: any) {
      console.error('Error generating blog:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to generate blog. Please try again.';
      setError(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedBlogDraft) return;

    const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    
    if (!companyHQId) {
      setError('Missing company context. Please complete onboarding first.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Use edited title/subtitle or fall back to generated
      const finalTitle = title.trim() || generatedBlogDraft.title || 'Untitled Blog';
      const finalSubtitle = subtitle.trim() || generatedBlogDraft.subtitle || undefined;

      // Create blog with generated BlogDraft
      // The API will merge sections into blogText and store sections separately
      const createResponse = await api.post('/api/content/blog', {
        companyHQId,
        title: finalTitle,
        subtitle: finalSubtitle,
        blogDraft: generatedBlogDraft, // Pass BlogDraft for processing
      });

      if (createResponse.data?.success && createResponse.data?.blog) {
        const savedBlog = createResponse.data.blog;
        
        // 🎯 LOCAL-FIRST: Save to localStorage immediately (both DB and localStorage)
        if (typeof window !== 'undefined' && companyHQId) {
          try {
            const cachedKey = `blogs_${companyHQId}`;
            const cached = localStorage.getItem(cachedKey);
            const blogs = cached ? JSON.parse(cached) : [];
            const existingIndex = blogs.findIndex((b: any) => b.id === savedBlog.id);
            if (existingIndex >= 0) {
              blogs[existingIndex] = savedBlog;
            } else {
              blogs.unshift(savedBlog); // Add to beginning
            }
            localStorage.setItem(cachedKey, JSON.stringify(blogs));
            console.log('✅ [LOCAL-FIRST] Saved blog to localStorage');
          } catch (e) {
            console.warn('[LOCAL-FIRST] Failed to save to localStorage:', e);
          }
        }
        
        // Clean up Redis key if stored
        if (redisKey) {
          try {
            await api.delete(`/api/content/blog/draft/${redisKey}`);
          } catch (e) {
            console.warn('Failed to clean up Redis key:', e);
          }
        }
        
        router.push(`/content/blog/${savedBlog.id}`);
      } else {
        throw new Error('Failed to create blog');
      }
    } catch (err: any) {
      console.error('Error saving blog:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to save blog. Please try again.';
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Build from Idea"
          subtitle="Enter your idea and let AI create a structured blog post"
          backTo="/content/blog/build"
          backLabel="Back to Create Blog"
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow mt-8">
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!generatedBlogDraft && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Blog Idea *
                  </label>
                  <p className="mb-2 text-xs text-gray-500">
                    Enter your core idea - the AI will generate a 500-word blog post starting with an introduction
                  </p>
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="e.g., How to improve client retention in legal services..."
                    rows={8}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={!idea.trim() || generating}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <Sparkles className="h-5 w-5" />
                    {generating ? 'Generating with AI...' : 'Generate Blog Draft'}
                  </button>
                </div>
              </>
            )}

            {/* Show generated blog draft for preview/edit */}
            {generatedBlogDraft && (
              <div className="space-y-6 border-t border-gray-200 pt-6">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <h3 className="text-sm font-semibold text-green-900 mb-1">✅ AI Generated Blog Draft</h3>
                  <p className="text-xs text-green-700">Review and edit the generated content below, then save to create your blog.</p>
                </div>

                {/* Title Preview/Edit */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Blog Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>

                {/* Subtitle Preview/Edit */}
                {generatedBlogDraft.subtitle && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                )}

                {/* Blog Content Preview */}
                {generatedBlogDraft.body?.sections && generatedBlogDraft.body.sections.length > 0 && (
                  <div>
                    <label className="mb-4 block text-sm font-semibold text-gray-700">
                      Blog Content ({generatedBlogDraft.body.sections.length} sections)
                    </label>
                    <div className="space-y-4 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
                      {generatedBlogDraft.body.sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            {section.heading || `Section ${sectionIndex + 1}`}
                          </h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{section.content}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Note: You can edit the full content after saving the blog.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                  <button
                    onClick={() => {
                      setGeneratedBlogDraft(null);
                      setRedisKey(null);
                      setTitle('');
                      setSubtitle('');
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
                    {saving ? 'Creating Blog...' : 'Save & Create Blog'}
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


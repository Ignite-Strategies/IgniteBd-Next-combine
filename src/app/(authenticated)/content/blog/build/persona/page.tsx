'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { UserCircle, Sparkles } from 'lucide-react';
import type { BlogIngest, BlogDraft } from '@/lib/blog-engine/types';

export default function BlogBuildPersonaPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [topic, setTopic] = useState('');
  const [problem, setProblem] = useState('');
  const [angle, setAngle] = useState('');
  const [targetLength, setTargetLength] = useState(600); // Default 500-700 range
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generatedBlogDraft, setGeneratedBlogDraft] = useState(null);
  const [redisKey, setRedisKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/personas?companyHQId=${companyHQId}`);
      if (response.data && Array.isArray(response.data)) {
        setPersonas(response.data);
      }
    } catch (err) {
      console.error('Error loading personas:', err);
      alert('Failed to load personas. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedPersona) {
      alert('Please select a persona first');
      return;
    }

    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    if (!problem.trim()) {
      alert('Please enter the BD challenge/problem this blog solves');
      return;
    }

    try {
      setGenerating(true);
      
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      // Build BlogIngest object
      const blogIngest: BlogIngest = {
        mode: 'persona',
        personaId: selectedPersona.id,
        persona: selectedPersona,
        topic: topic.trim(),
        problem: problem.trim(),
        angle: angle.trim() || undefined,
        targetLength: targetLength,
        companyHQId,
      };
      
      // Call AI route to generate blog
      const aiResponse = await api.post('/api/workme/blog/ai', {
        blogIngest,
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
      const createResponse = await api.post('/api/content/blog', {
        companyHQId,
        title: finalTitle,
        subtitle: finalSubtitle,
        blogDraft: generatedBlogDraft,
      });

      if (createResponse.data?.success && createResponse.data?.blog) {
        const savedBlog = createResponse.data.blog;
        
        // 🎯 LOCAL-FIRST: Save to localStorage
        if (typeof window !== 'undefined' && companyHQId) {
          try {
            const cachedKey = `blogs_${companyHQId}`;
            const cached = localStorage.getItem(cachedKey);
            const blogs = cached ? JSON.parse(cached) : [];
            const existingIndex = blogs.findIndex((b: any) => b.id === savedBlog.id);
            if (existingIndex >= 0) {
              blogs[existingIndex] = savedBlog;
            } else {
              blogs.unshift(savedBlog);
            }
            localStorage.setItem(cachedKey, JSON.stringify(blogs));
            console.log('✅ [LOCAL-FIRST] Saved blog to localStorage');
          } catch (e) {
            console.warn('[LOCAL-FIRST] Failed to save to localStorage:', e);
          }
        }
        
        // Clean up Redis key
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
          title="Build from Persona"
          subtitle="Select a persona to generate a targeted blog post"
          backTo="/content/blog"
          backLabel="Back to Blogs"
        />

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow">
            <p className="text-gray-600">Loading personas...</p>
          </div>
        ) : personas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
            <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No personas found</p>
            <p className="text-sm text-gray-500 mb-6">
              Create personas first to generate targeted blog posts
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Persona</h3>
              <div className="space-y-3">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      selectedPersona?.id === persona.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selectedPersona?.id === persona.id}
                        onChange={() => setSelectedPersona(persona)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{persona.name || persona.personName}</h4>
                        {persona.title && (
                          <p className="text-sm text-gray-600">{persona.title}</p>
                        )}
                        {persona.painPoints && Array.isArray(persona.painPoints) && persona.painPoints.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Top Problems:</p>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {persona.painPoints.slice(0, 3).map((point, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="mr-2">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {selectedPersona && !generatedBlogDraft && (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Persona Summary</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Name:</strong> {selectedPersona.name || selectedPersona.personName}</p>
                    {selectedPersona.title && <p><strong>Title:</strong> {selectedPersona.title}</p>}
                    {selectedPersona.painPoints && Array.isArray(selectedPersona.painPoints) && selectedPersona.painPoints.length > 0 && (
                      <div>
                        <p className="font-semibold mb-1">Top Problems:</p>
                        <ul className="space-y-1 ml-4">
                          {selectedPersona.painPoints.slice(0, 3).map((point, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Blog Details</h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Topic *
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Client retention strategies for legal services"
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Problem / BD Challenge *
                    </label>
                    <textarea
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      placeholder="What BD challenge does this blog solve? e.g., How to retain clients in competitive markets"
                      rows={3}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Angle (Optional)
                    </label>
                    <select
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    >
                      <option value="">Select an angle (optional)</option>
                      <option value="efficiency">Efficiency</option>
                      <option value="dealmaking">Dealmaking</option>
                      <option value="risk">Risk</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Target Word Count
                    </label>
                    <select
                      value={targetLength}
                      onChange={(e) => setTargetLength(Number(e.target.value))}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    >
                      <option value={300}>300 words</option>
                      <option value={500}>500 words</option>
                      <option value={600}>600 words (default)</option>
                      <option value={700}>700 words</option>
                      <option value={1000}>1000 words</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {!generatedBlogDraft && (
              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedPersona || !topic.trim() || !problem.trim() || generating}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <Sparkles className="h-5 w-5" />
                  {generating ? 'Generating with AI...' : 'Generate Blog Draft'}
                </button>
              </div>
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
                      {generatedBlogDraft.body.sections.map((section: any, sectionIndex: number) => (
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
        )}
      </div>
    </div>
  );
}


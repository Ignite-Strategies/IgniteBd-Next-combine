'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, ArrowLeft, Trash2, Download, ExternalLink, Copy, Check } from 'lucide-react';
import api from '@/lib/api';

export default function BlogEditorPage() {
  const params = useParams();
  const router = useRouter();
  const blogId = params.id;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [blogText, setBlogText] = useState('');
  const [sections, setSections] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState(null);
  const [savedGoogleDocUrl, setSavedGoogleDocUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  // 🎯 Check if googleDocUrl exists on load - if it does, we don't need to export again
  useEffect(() => {
    if (blogId) {
      loadBlog();
    }
  }, [blogId]);

  // 🎯 useEffect to check if googleDocUrl exists and prevent re-export
  useEffect(() => {
    if (savedGoogleDocUrl) {
      console.log('✅ Google Doc URL already exists, export not needed');
    }
  }, [savedGoogleDocUrl]);

  const loadBlog = async () => {
    try {
      setLoading(true);
      
      // 🎯 LOCAL-FIRST: Try to load from localStorage first
      let blog = null;
      const companyHQId = typeof window !== 'undefined' 
        ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
        : '';
      
      if (typeof window !== 'undefined' && companyHQId) {
        // First try: blogs_${companyHQId}
        try {
          const stored = localStorage.getItem(`blogs_${companyHQId}`);
          if (stored) {
            const blogs = JSON.parse(stored);
            blog = Array.isArray(blogs) ? blogs.find(b => b.id === blogId) : null;
            if (blog) {
              console.log('✅ [LOCAL-FIRST] Loaded blog from localStorage');
            }
          }
        } catch (e) {
          console.warn('[LOCAL-FIRST] Failed to parse blogs from localStorage:', e);
        }
        
        // Second try: companyHydration_${companyHQId}
        if (!blog) {
          try {
            const hydrationKey = `companyHydration_${companyHQId}`;
            const hydrationData = localStorage.getItem(hydrationKey);
            if (hydrationData) {
              const parsed = JSON.parse(hydrationData);
              if (parsed?.data?.blogs && Array.isArray(parsed.data.blogs)) {
                blog = parsed.data.blogs.find(b => b.id === blogId);
                if (blog) {
                  console.log('✅ [LOCAL-FIRST] Loaded blog from hydration data');
                }
              }
            }
          } catch (e) {
            console.warn('[LOCAL-FIRST] Failed to parse hydration data:', e);
          }
        }
      }
      
      // If found locally, use it
      if (blog) {
        setTitle(blog.title || '');
        setSubtitle(blog.subtitle || '');
        setBlogText(blog.blogText || '');
        setSections(blog.sections || null);
        setSavedGoogleDocUrl(blog.googleDocUrl || null);
        setLoading(false);
        return;
      }
      
      // 🎯 FALLBACK: Load from API if not found locally
      console.log('🔄 [LOCAL-FIRST] Blog not found locally, fetching from API...');
      const response = await api.get(`/api/content/blog/${blogId}`);
      if (response.data?.success) {
        blog = response.data.blog;
        console.log('📦 Loaded blog from database:', blog.id);
        
        setTitle(blog.title || '');
        setSubtitle(blog.subtitle || '');
        setBlogText(blog.blogText || '');
        setSections(blog.sections || null);
        setSavedGoogleDocUrl(blog.googleDocUrl || null);
        
        // Update localStorage with the fetched blog
        if (typeof window !== 'undefined' && companyHQId) {
          try {
            const cachedKey = `blogs_${companyHQId}`;
            const cached = localStorage.getItem(cachedKey);
            const blogs = cached ? JSON.parse(cached) : [];
            const existingIndex = blogs.findIndex((b: any) => b.id === blog.id);
            if (existingIndex >= 0) {
              blogs[existingIndex] = blog;
            } else {
              blogs.unshift(blog);
            }
            localStorage.setItem(cachedKey, JSON.stringify(blogs));
            console.log('💾 Updated localStorage with blog from API');
          } catch (e) {
            console.warn('Failed to update localStorage:', e);
          }
        }
      } else {
        console.error('Failed to load blog:', response.data);
        alert('Failed to load blog');
      }
    } catch (err) {
      console.error('Error loading blog:', err);
      // Only show alert if we couldn't load from localStorage either
      if (typeof window === 'undefined' || !localStorage.getItem(`blogs_${localStorage.getItem('companyHQId') || ''}`)) {
        alert('Failed to load blog. Please try again.');
      }
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

      const response = await api.patch(`/api/content/blog/${blogId}`, {
        title,
        subtitle,
        blogText,
        sections, // Preserve sections for future editing
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

        // Redirect immediately after successful save
        router.push('/content/blog');
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


  const handleExportToGoogleDocs = async () => {
    try {
      setExporting(true);
      setGoogleDocUrl(null);

      const response = await api.post(`/api/content/blog/${blogId}/push-to-google-docs`);

      if (response.data?.success) {
        const docUrl = response.data.documentUrl;
        setGoogleDocUrl(docUrl);
        setSavedGoogleDocUrl(docUrl); // Update saved URL
        
        // 🎯 LOCAL-FIRST: Update localStorage with the updated blog (including googleDocUrl)
        const companyHQId = typeof window !== 'undefined' 
          ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
          : '';
        
        if (companyHQId) {
          try {
            const cachedKey = `blogs_${companyHQId}`;
            const cached = localStorage.getItem(cachedKey);
            if (cached) {
              const blogs = JSON.parse(cached);
              const existingIndex = blogs.findIndex((b: any) => b.id === blogId);
              if (existingIndex >= 0) {
                // Update the blog with the new googleDocUrl
                blogs[existingIndex] = {
                  ...blogs[existingIndex],
                  googleDocUrl: docUrl,
                };
                localStorage.setItem(cachedKey, JSON.stringify(blogs));
                console.log('💾 Updated localStorage with googleDocUrl');
              }
            }
          } catch (e) {
            console.warn('Failed to update localStorage with googleDocUrl:', e);
          }
        }
        
        // For export, automatically open in new tab
        window.open(docUrl, '_blank');
      } else {
        throw new Error(response.data?.error || 'Failed to export to Google Docs');
      }
    } catch (err) {
      console.error('Error exporting to Google Docs:', err);
      alert(`Failed to export blog to Google Docs: ${err.response?.data?.details || err.message}`);
    } finally {
      setExporting(false);
    }
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Blog Text *
              </label>
              <textarea
                value={blogText}
                onChange={(e) => setBlogText(e.target.value)}
                placeholder="Blog content..."
                rows={20}
                className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Structured sections are stored separately for future editing
              </p>
            </div>

            {(googleDocUrl || savedGoogleDocUrl) && (
              <div className="rounded-lg border border-green-300 bg-green-50 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-green-800">
                    ✅ Google Doc Available
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={googleDocUrl || savedGoogleDocUrl || ''}
                      className="flex-1 rounded border border-green-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={async () => {
                        const url = googleDocUrl || savedGoogleDocUrl;
                        if (url) {
                          try {
                            await navigator.clipboard.writeText(url);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (err) {
                            console.error('Failed to copy:', err);
                            // Fallback: select and copy
                            const input = document.createElement('input');
                            input.value = url;
                            document.body.appendChild(input);
                            input.select();
                            document.execCommand('copy');
                            document.body.removeChild(input);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-700 hover:text-green-900 border border-green-300 rounded hover:bg-green-100 transition-colors"
                      title="Copy URL to clipboard"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <a
                    href={googleDocUrl || savedGoogleDocUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Google Docs
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              
              <div className="flex items-center gap-4">
                {/* Only show export button if googleDocUrl doesn't exist */}
                {!savedGoogleDocUrl && !googleDocUrl && (
                  <button
                    onClick={handleExportToGoogleDocs}
                    disabled={exporting || !blogText.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {exporting ? 'Exporting...' : 'Export to Google Docs'}
                  </button>
                )}
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
    </div>
  );
}


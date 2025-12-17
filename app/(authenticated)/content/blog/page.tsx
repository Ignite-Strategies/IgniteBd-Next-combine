'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText, Plus, Edit2, Eye, RefreshCw, Trash2, UserCircle, Lightbulb, FileStack, PenTool, Download, ExternalLink, Copy, Check } from 'lucide-react';

// 🎯 LOCAL-FIRST FLAG: API sync is optional and explicit only
const ENABLE_BLOG_API_SYNC = true;

export default function BlogPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [exportingBlogId, setExportingBlogId] = useState(null);
  const [copiedBlogId, setCopiedBlogId] = useState<string | null>(null);

  const [companyHQId, setCompanyHQId] = useState('');

  // 🎯 LOCAL-FIRST: Load ONLY from localStorage on mount - NO API CALLS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Get companyHQId (for syncing button only - not required for display)
    const id = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    setCompanyHQId(id);

    // 🎯 LOCAL-FIRST: Load from localStorage - localStorage is authoritative
    try {
      let loaded = false;
      
      // First try: blogs_${id} (if we have id)
      if (id) {
        const stored = localStorage.getItem(`blogs_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBlogs(parsed);
            loaded = true;
            console.log('✅ [LOCAL-FIRST] Loaded', parsed.length, 'blogs from localStorage');
            // Debug: Check for googleDocUrl in loaded blogs
            const blogsWithGoogleDoc = parsed.filter(b => b.googleDocUrl);
            console.log(`📊 [LOCAL-FIRST] Found ${blogsWithGoogleDoc.length} blogs with googleDocUrl out of ${parsed.length} total`);
            parsed.forEach(b => {
              console.log(`  - "${b.title}": ${b.googleDocUrl ? 'HAS googleDocUrl' : 'NO googleDocUrl'}`, b.googleDocUrl || '');
            });
          }
        }
      }
      
      // Second try: Check hydration data (companyHydration_${id})
      if (!loaded && id) {
        const hydrationKey = `companyHydration_${id}`;
        const hydrationData = localStorage.getItem(hydrationKey);
        if (hydrationData) {
          try {
            const parsed = JSON.parse(hydrationData);
            if (parsed?.data?.blogs && Array.isArray(parsed.data.blogs)) {
              setBlogs(parsed.data.blogs);
              loaded = true;
              console.log('✅ [LOCAL-FIRST] Loaded', parsed.data.blogs.length, 'blogs from hydration data');
            }
          } catch (e) {
            console.warn('[LOCAL-FIRST] Failed to parse hydration data:', e);
          }
        }
      }
      
      // Third try: Check any blogs_* key (fallback)
      if (!loaded) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('blogs_')) {
            try {
              const stored = localStorage.getItem(key);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setBlogs(parsed);
                  loaded = true;
                  console.log('✅ [LOCAL-FIRST] Loaded', parsed.length, 'blogs from fallback localStorage key:', key);
                  break;
                }
              }
            } catch (e) {
              // Skip invalid entries
            }
          }
        }
      }
      
      // 🎯 LOCAL-FIRST: If nothing loaded, show empty state (NO AUTO-SYNC)
      if (!loaded) {
        setBlogs([]);
        console.log('ℹ️ [LOCAL-FIRST] No blogs found in localStorage - click Sync to load from server');
      }
    } catch (err) {
      console.warn('[LOCAL-FIRST] Failed to load blogs from localStorage:', err);
      setBlogs([]);
    }
    
    setLoading(false);
  }, []);

  // 🎯 LOCAL-FIRST: API sync is explicit and optional - only called by user clicking Sync button
  const handleSync = async () => {
    // Check if API sync is enabled
    if (!ENABLE_BLOG_API_SYNC) {
      console.warn('⚠️ [LOCAL-FIRST] API sync is disabled - skipping');
      return;
    }

    // Get companyHQId
    const id = companyHQId || (typeof window !== 'undefined'
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
      : '');
    
    if (!id) {
      console.warn('⚠️ [LOCAL-FIRST] No companyHQId available for sync');
      setError('Company ID not found. Cannot sync.');
      return;
    }

    try {
      setSyncing(true);
      setLoading(true);
      setError('');
      
      console.log('🔄 [LOCAL-FIRST] Starting explicit API sync...');
      
      const response = await api.get(`/api/content/blog?companyHQId=${id}`);
      
      if (response.data?.success) {
        const fetchedBlogs = response.data.blogs || [];
        
        // Log to verify we got full objects
        if (fetchedBlogs.length > 0) {
          console.log('✅ [LOCAL-FIRST] Synced blog sample fields:', Object.keys(fetchedBlogs[0]).join(', '));
          // Check for googleDocUrl in synced blogs
          const blogsWithGoogleDoc = fetchedBlogs.filter(b => b.googleDocUrl);
          console.log(`📊 [LOCAL-FIRST] Found ${blogsWithGoogleDoc.length} blogs with googleDocUrl out of ${fetchedBlogs.length} total`);
          blogsWithGoogleDoc.forEach(b => {
            console.log(`  - "${b.title}": ${b.googleDocUrl}`);
          });
        }
        
        // 🎯 LOCAL-FIRST: Update localStorage (authoritative source)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`blogs_${id}`, JSON.stringify(fetchedBlogs));
          console.log('✅ [LOCAL-FIRST] Updated localStorage with', fetchedBlogs.length, 'blogs');
        }
        
        // Update in-memory state
        setBlogs(fetchedBlogs);
        console.log('✅ [LOCAL-FIRST] Sync completed successfully');
      } else {
        throw new Error(response.data?.error || 'Sync failed');
      }
    } catch (err) {
      console.error('❌ [LOCAL-FIRST] Error syncing blogs:', err);
      setError('Failed to sync blogs. Your local data is unchanged.');
      // 🎯 LOCAL-FIRST: Leave localStorage untouched on error
      // Do not update state - keep showing local data
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  const handleExportToGoogleDocs = async (blogId, e) => {
    e.stopPropagation();
    
    try {
      setExportingBlogId(blogId);
      const response = await api.post(`/api/content/blog/${blogId}/push-to-google-docs`);

      if (response.data?.success) {
        const docUrl = response.data.documentUrl;
        
        // 🎯 LOCAL-FIRST: Update localStorage with the updated blog (including googleDocUrl)
        const id = companyHQId || (typeof window !== 'undefined'
          ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
          : '');
        
        if (id) {
          try {
            const cachedKey = `blogs_${id}`;
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
                // Update in-memory state
                setBlogs(blogs);
                console.log('💾 Updated localStorage and state with googleDocUrl');
              }
            }
          } catch (e) {
            console.warn('Failed to update localStorage with googleDocUrl:', e);
          }
        }
        
        // For export, always open in new tab
        window.open(docUrl, '_blank');
      } else {
        throw new Error(response.data?.error || 'Failed to export to Google Docs');
      }
    } catch (err) {
      console.error('Error exporting to Google Docs:', err);
      alert(`Failed to export blog to Google Docs: ${err.response?.data?.details || err.message}`);
    } finally {
      setExportingBlogId(null);
    }
  };

  const handleDelete = async (blogId, e) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this blog? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/content/blog/${blogId}`);
      if (response.data?.success) {
        // 🎯 LOCAL-FIRST: Remove from localStorage
        const id = companyHQId || localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        if (id) {
          const cachedKey = `blogs_${id}`;
          try {
            const cached = localStorage.getItem(cachedKey);
            if (cached) {
              const cachedBlogs = JSON.parse(cached);
              const updated = cachedBlogs.filter(b => b.id !== blogId);
              localStorage.setItem(cachedKey, JSON.stringify(updated));
              console.log('✅ [LOCAL-FIRST] Removed blog from localStorage');
            }
          } catch (e) {
            console.warn('[LOCAL-FIRST] Failed to update localStorage:', e);
          }
        }
        
        // Update in-memory state
        setBlogs(blogs.filter(b => b.id !== blogId));
      } else {
        throw new Error('Failed to delete blog');
      }
    } catch (err) {
      console.error('Error deleting blog:', err);
      alert('Failed to delete blog. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const buildOptions = [
    {
      title: 'Build from Persona',
      description: 'Generate a blog post targeted to a specific persona',
      icon: UserCircle,
      route: '/content/blog/build/persona',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Build from Idea',
      description: 'Start with a core theme or idea',
      icon: Lightbulb,
      route: '/content/blog/build/idea',
      color: 'from-yellow-500 to-yellow-600',
    },
    {
      title: 'Build from Previous Blog',
      description: 'Use an existing blog as a starting point',
      icon: FileStack,
      route: '/content/blog/build/previous',
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Start Empty',
      description: 'Write a blog from scratch',
      icon: PenTool,
      route: '/content/blog/build/write',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between mb-8">
          <PageHeader
            title="Blogs"
            subtitle="Create and manage blog content for your website."
            backTo="/content"
            backLabel="Back to Content Studio"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing || !ENABLE_BLOG_API_SYNC}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title={ENABLE_BLOG_API_SYNC ? "Sync blogs from server" : "API sync is disabled"}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Build Options Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Blog</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {buildOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.route}
                  onClick={() => router.push(option.route)}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow hover:shadow-lg transition-all text-left group"
                >
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${option.color} mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                    {option.title}
                  </h3>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Existing Blogs List */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Blogs</h2>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
            {error}
          </div>
        )}

        {blogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No blogs yet</p>
            <p className="text-sm text-gray-500">
              {ENABLE_BLOG_API_SYNC 
                ? 'Create your first blog using one of the options above, or click Sync to load from server'
                : 'Create your first blog using one of the options above'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {blogs.map((blog) => {
              // Debug: Log blog data to console (always log for debugging)
              console.log('📝 Blog data:', {
                id: blog.id,
                title: blog.title,
                hasGoogleDocUrl: !!blog.googleDocUrl,
                googleDocUrl: blog.googleDocUrl || 'NO googleDocUrl',
                allKeys: Object.keys(blog),
              });
              
              return (
                <div
                  key={blog.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="rounded-lg bg-blue-100 p-2 flex-shrink-0">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 mb-0.5 truncate">
                          {blog.title || 'Untitled Blog'}
                        </h3>
                        {blog.subtitle && (
                          <p className="text-xs text-gray-600 mb-1 truncate">
                            {blog.subtitle}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Created {formatDate(blog.createdAt)}
                        </p>
                        {blog.googleDocUrl ? (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <span>✓</span>
                              <span>Google Doc Available</span>
                            </div>
                            <a
                              href={blog.googleDocUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Google Doc
                            </a>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (blog.googleDocUrl) {
                                  try {
                                    await navigator.clipboard.writeText(blog.googleDocUrl);
                                    setCopiedBlogId(blog.id);
                                    setTimeout(() => setCopiedBlogId(null), 2000);
                                  } catch (err) {
                                    console.error('Failed to copy:', err);
                                    setCopiedBlogId(blog.id);
                                    setTimeout(() => setCopiedBlogId(null), 2000);
                                  }
                                }
                              }}
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                              title="Copy Google Doc URL"
                            >
                              {copiedBlogId === blog.id ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  <span className="text-green-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy URL</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500">
                            No Google Doc URL (click "Export to Google Docs" to create one)
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      <button
                        onClick={() => router.push(`/content/blog/${blog.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      {/* Only show export button if googleDocUrl doesn't exist */}
                      {!blog.googleDocUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportToGoogleDocs(blog.id, e);
                          }}
                          disabled={exportingBlogId === blog.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className={`h-3.5 w-3.5 ${exportingBlogId === blog.id ? 'animate-spin' : ''}`} />
                          <span>{exportingBlogId === blog.id ? 'Exporting...' : 'Export to Google Docs'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/content/blog/${blog.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(blog.id, e)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


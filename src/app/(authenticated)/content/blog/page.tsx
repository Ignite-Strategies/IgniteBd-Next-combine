'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText, Plus, Edit2, Eye, RefreshCw, Trash2, UserCircle, Lightbulb, FileStack, PenTool } from 'lucide-react';

export default function BlogPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        setSyncing(false);
        return;
      }

      const cachedKey = `blogs_${companyHQId}`;

      // Try to load from localStorage first (only if not forcing refresh)
      if (!forceRefresh && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(cachedKey);
          if (cached) {
            const cachedBlogs = JSON.parse(cached);
            if (Array.isArray(cachedBlogs) && cachedBlogs.length > 0) {
              console.log(`📦 Loaded ${cachedBlogs.length} blogs from localStorage`);
              setBlogs(cachedBlogs);
              setLoading(false);
            }
          }
        } catch (e) {
          console.warn('Failed to load from localStorage:', e);
        }
      }

      // Always fetch fresh data from API
      const response = await api.get(`/api/content/blog?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        const freshBlogs = response.data.blogs || [];
        console.log(`✅ Fetched ${freshBlogs.length} blogs from API`);
        setBlogs(freshBlogs);
        
        // Update localStorage with fresh data
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(cachedKey, JSON.stringify(freshBlogs));
            console.log('💾 Updated localStorage with fresh blogs');
          } catch (e) {
            console.warn('Failed to update localStorage:', e);
          }
        }
      } else {
        console.warn('API response not successful:', response.data);
      }
    } catch (err) {
      console.error('Error loading blogs:', err);
      alert('Failed to load blogs. Please try again.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleSync = () => {
    loadBlogs(true);
  };

  const handleDelete = async (blogId, e) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this blog? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/content/blog/${blogId}`);
      if (response.data?.success) {
        // Remove from state
        setBlogs(blogs.filter(b => b.id !== blogId));
        
        // Remove from localStorage
        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        if (companyHQId) {
          const cachedKey = `blogs_${companyHQId}`;
          try {
            const cached = localStorage.getItem(cachedKey);
            if (cached) {
              const cachedBlogs = JSON.parse(cached);
              const updated = cachedBlogs.filter(b => b.id !== blogId);
              localStorage.setItem(cachedKey, JSON.stringify(updated));
            }
          } catch (e) {
            console.warn('Failed to update localStorage:', e);
          }
        }
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
              disabled={syncing || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Sync blogs from database"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync
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

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow">
            <p className="text-gray-600">Loading blogs...</p>
          </div>
        ) : blogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No blogs yet</p>
            <p className="text-sm text-gray-500">
              Create your first blog using one of the options above
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blogs.map((blog) => {
              return (
                <div
                  key={blog.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="rounded-lg bg-blue-100 p-3">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {blog.title || 'Untitled Blog'}
                        </h3>
                        {blog.subtitle && (
                          <p className="text-sm text-gray-600 mb-2">
                            {blog.subtitle}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Created {formatDate(blog.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/content/blog/${blog.id}`)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button
                        onClick={() => router.push(`/content/blog/${blog.id}`)}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(blog.id, e)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
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


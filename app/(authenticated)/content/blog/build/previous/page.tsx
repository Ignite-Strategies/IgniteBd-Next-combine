'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText, Copy } from 'lucide-react';

export default function BlogBuildPreviousPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/content/blog?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        setBlogs(response.data.blogs || []);
      }
    } catch (err) {
      console.error('Error loading blogs:', err);
      alert('Failed to load blogs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async () => {
    if (!selectedBlog) {
      alert('Please select a blog first');
      return;
    }

    try {
      setCloning(true);
      
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      // Clone the blog - copy all content
      const createResponse = await api.post('/api/content/blog', {
        companyHQId,
        title: `${selectedBlog.title} (Copy)`,
        subtitle: selectedBlog.subtitle,
        content: selectedBlog.content, // Clone entire content JSON
      });

      if (createResponse.data?.success) {
        router.push(`/content/blog/${createResponse.data.blog.id}`);
      } else {
        throw new Error('Failed to clone blog');
      }
    } catch (err) {
      console.error('Error cloning blog:', err);
      alert('Failed to clone blog. Please try again.');
    } finally {
      setCloning(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Build from Previous Blog"
          subtitle="Select an existing blog to use as a template"
          backTo="/content/blog/build"
          backLabel="Back to Create Blog"
        />

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow mt-8">
            <p className="text-gray-600">Loading blogs...</p>
          </div>
        ) : blogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow mt-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No blogs found</p>
            <p className="text-sm text-gray-500 mb-6">
              Create a blog first to use as a template
            </p>
          </div>
        ) : (
          <div className="space-y-6 mt-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Blog</h3>
              <div className="space-y-3">
                {blogs.map((blog) => (
                  <div
                    key={blog.id}
                    onClick={() => setSelectedBlog(blog)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      selectedBlog?.id === blog.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selectedBlog?.id === blog.id}
                        onChange={() => setSelectedBlog(blog)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{blog.title}</h4>
                        {blog.subtitle && (
                          <p className="text-sm text-gray-600 mt-1">{blog.subtitle}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Created {formatDate(blog.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleClone}
                disabled={!selectedBlog || cloning}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Copy className="h-5 w-5" />
                {cloning ? 'Cloning...' : 'Clone Blog'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


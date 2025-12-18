'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { assembleBlogText } from '@/lib/utils/blogTextAssembly';
import { formatBlogContent } from '@/lib/utils/blogFormatter';

export default function BlogViewPage() {
  const params = useParams();
  const router = useRouter();
  const blogId = params.id as string;

  const [blog, setBlog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (blogId) {
      loadBlog();
    }
  }, [blogId]);

  const loadBlog = () => {
    try {
      setLoading(true);
      
      // Load from localStorage
      const companyHQId = localStorage.getItem('companyHQId') || '';
      if (!companyHQId) {
        setLoading(false);
        return;
      }

      const stored = localStorage.getItem(`blogs_${companyHQId}`);
      if (stored) {
        const blogs = JSON.parse(stored);
        const foundBlog = blogs.find((b: any) => b.id === blogId);
        if (foundBlog) {
          setBlog(foundBlog);
        }
      }
    } catch (err) {
      console.error('Error loading blog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!blog) return;

    const assembledText = assembleBlogText({
      title: blog.title,
      subtitle: blog.subtitle,
      body: blog.blogText,
    });

    try {
      await navigator.clipboard.writeText(assembledText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-8">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-white py-8">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-gray-500">Blog not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.push('/content/blog')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Blogs
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                Copy Full Blog
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-900">
            Use this to paste into Word or Google Docs.
          </p>
        </div>

        {/* Blog Content */}
        <article className="prose prose-lg max-w-none">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {blog.title || 'Untitled Blog'}
          </h1>

          {/* Subtitle */}
          {blog.subtitle && (
            <h2 className="text-2xl font-semibold text-gray-700 mb-6">
              {blog.subtitle}
            </h2>
          )}

          {/* Body - Auto-formatted with Markdown support */}
          {blog.blogText && (
            <div className="blog-content">
              {formatBlogContent(blog.blogText)}
            </div>
          )}
        </article>

        {/* Bottom Copy Button */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-8 py-4 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5" />
                Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                Copy Full Blog
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

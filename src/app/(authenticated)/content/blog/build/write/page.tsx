'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText } from 'lucide-react';

export default function BlogBuildWritePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    try {
      setCreating(true);
      
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      // Create empty blog
      const createResponse = await api.post('/api/content/blog', {
        companyHQId,
        title: 'Untitled Blog',
        subtitle: '',
        content: {}, // Empty content object
      });

      if (createResponse.data?.success) {
        router.push(`/content/blog/${createResponse.data.blog.id}`);
      } else {
        throw new Error('Failed to create blog');
      }
    } catch (err) {
      console.error('Error creating blog:', err);
      alert('Failed to create blog. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Just Write"
          subtitle="Start with a blank blog and write from scratch"
          backTo="/content/blog/build"
          backLabel="Back to Create Blog"
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow mt-8">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-800 mb-2">Start Writing</p>
          <p className="text-sm text-gray-500 mb-6">
            Create a new blog post and start writing from scratch
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all mx-auto disabled:opacity-50"
          >
            <FileText className="h-5 w-5" />
            {creating ? 'Creating...' : 'Create Blank Blog'}
          </button>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { Sparkles } from 'lucide-react';

export default function BlogBuildIdeaPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      alert('Please enter an idea first');
      return;
    }

    try {
      setGenerating(true);
      
      // Call AI route to generate blog
      const aiResponse = await api.post('/api/workme/blog/ai', {
        mode: 'idea',
        idea: idea.trim(),
      });

      if (aiResponse.data?.success) {
        const { title, subtitle, content } = aiResponse.data;
        
        // Create blog with generated content
        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        const createResponse = await api.post('/api/content/blog', {
          companyHQId,
          title,
          subtitle,
          content,
        });

        if (createResponse.data?.success) {
          router.push(`/content/blog/${createResponse.data.blog.id}`);
        } else {
          throw new Error('Failed to create blog');
        }
      } else {
        throw new Error('Failed to generate blog');
      }
    } catch (err) {
      console.error('Error generating blog:', err);
      alert('Failed to generate blog. Please try again.');
    } finally {
      setGenerating(false);
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Blog Idea
              </label>
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
                {generating ? 'Generating...' : 'Generate Blog Draft'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


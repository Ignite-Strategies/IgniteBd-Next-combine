'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { FileText, Sparkles, UserCircle, Copy } from 'lucide-react';

export default function BlogBuildPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Blog"
          subtitle="Choose how you want to start building your blog"
          backTo="/content/blog"
          backLabel="Back to Blogs"
        />

        {/* Four Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Build from Persona */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => router.push('/content/blog/build/persona')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <UserCircle className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build from Persona</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Tailor your blog to a specific persona
            </p>
            <p className="text-sm text-gray-600">
              Select a persona and generate a blog post targeted to their needs and interests
            </p>
          </div>

          {/* Build from Idea */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow" 
            onClick={() => router.push('/content/blog/build/idea')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build from Idea</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Generate a blog draft using AI
            </p>
            <p className="text-sm text-gray-600">
              Enter your idea and let AI create a structured blog post for you
            </p>
          </div>

          {/* Build from Previous Blog */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow" 
            onClick={() => router.push('/content/blog/build/previous')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Copy className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build from Previous Blog</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Clone an existing blog
            </p>
            <p className="text-sm text-gray-600">
              Start from an existing blog as a template
            </p>
          </div>

          {/* Just Write */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => router.push('/content/blog/build/write')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-red-100 p-2">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Just Write</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Start with a blank blog
            </p>
            <p className="text-sm text-gray-600">
              Create a new blog from scratch and write it step by step
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


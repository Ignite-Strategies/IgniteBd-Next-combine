'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { FileText, Sparkles, UserCircle } from 'lucide-react';

export default function PresentationsBuildPage() {
  const router = useRouter();

  const handleBuildFromScratch = async () => {
    try {
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      if (!companyHQId) {
        alert('Company ID not found. Please refresh the page.');
        return;
      }

      // Create presentation with auto-hydrated structure
      const response = await api.post('/api/content/presentations', {
        companyHQId,
        title: 'Untitled Presentation',
        slides: {
          sections: [
            { title: 'Introduction', bullets: [] },
            { title: 'Problem', bullets: [] },
            { title: 'Insights', bullets: [] },
            { title: 'Case Study', bullets: [] },
            { title: 'Proof Points', bullets: [] },
            { title: 'CTA', bullets: [] },
          ],
        },
        published: false,
      });

      if (response.data?.success && response.data?.presentation) {
        router.push(`/builder/cledeck/${response.data.presentation.id}`);
      } else {
        throw new Error('Failed to create presentation');
      }
    } catch (err) {
      console.error('Error creating presentation:', err);
      alert('Failed to create presentation. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Build Presentation"
          subtitle="Choose how you want to start building your presentation"
          backTo="/content/presentations"
          backLabel="Back to Presentations"
        />

        {/* Four Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Build From Scratch */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
            onClick={handleBuildFromScratch}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-red-100 p-2">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build From Scratch</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Start with a blank presentation and build it step by step
            </p>
            <p className="text-sm text-gray-600">
              Create a new presentation with a basic structure that you can customize
            </p>
          </div>

          {/* Build With Persona */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow opacity-60" 
            onClick={() => router.push('/content/presentations/persona')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <UserCircle className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build With Persona</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Coming Soon
            </p>
            <p className="text-sm text-gray-600">
              Tailor your presentation to a specific persona
            </p>
          </div>

          {/* Build With AI */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow" 
            onClick={() => router.push('/content/presentations/ai')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Build With AI</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Generate a presentation outline using AI
            </p>
            <p className="text-sm text-gray-600">
              Enter your idea and let AI create a structured outline for you
            </p>
          </div>

          {/* Use Previous Presentation */}
          <div 
            className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-shadow opacity-60" 
            onClick={() => router.push('/content/presentations/from-existing')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-green-100 p-2">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Use Previous Presentation</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Coming Soon
            </p>
            <p className="text-sm text-gray-600">
              Start from an existing presentation as a template
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

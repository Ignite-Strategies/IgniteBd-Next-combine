'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { Save, Sparkles, UserCircle, FileText } from 'lucide-react';

// Auto-hydrated placeholder sections
const defaultSections = [
  'Introduction',
  'Problem',
  'Insights',
  'Proof Points',
  'Case Study',
  'CTA / Next Steps',
];

export default function PresentationsBuildPage() {
  const router = useRouter();
  const [title, setTitle] = useState('Untitled Presentation');
  const [sections, setSections] = useState(defaultSections);
  const [saving, setSaving] = useState(false);

  const handleSectionChange = (index, newValue) => {
    const updated = [...sections];
    updated[index] = newValue;
    setSections(updated);
  };

  const handleConvertToPresentation = async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      if (!companyHQId) {
        alert('Company ID not found. Please refresh the page.');
        return;
      }

      // Create CleDeck with auto-hydrated structure
      const response = await api.post('/api/artifacts/cledecks', {
        companyHQId,
        title,
        slides: {
          sections: sections.map((section, index) => ({
            order: index + 1,
            title: section,
            content: '',
          })),
        },
        description: 'Auto-hydrated presentation structure',
        published: false,
      });

      if (response.data?.success && response.data?.cledeck) {
        router.push(`/builder/cledeck/${response.data.cledeck.id}`);
      } else {
        throw new Error('Failed to create presentation');
      }
    } catch (err) {
      console.error('Error creating presentation:', err);
      alert('Failed to create presentation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <PageHeader
              title="Build Presentation"
              subtitle="Edit your presentation structure, then convert to full editor"
              backTo="/content/presentations"
              backLabel="Back to Presentations"
            />

            {/* Title Field */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Presentation Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-lg font-semibold"
                placeholder="Untitled Presentation"
              />
            </div>

            {/* Slide Outline Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Slide Outline
              </label>
              <div className="space-y-3">
                {sections.map((section, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-semibold text-red-600">
                        {index + 1}
                      </div>
                      <textarea
                        value={section}
                        onChange={(e) => handleSectionChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 rounded border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
                        rows={2}
                        placeholder="Section title"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary CTA */}
            <div className="flex justify-end">
              <button
                onClick={handleConvertToPresentation}
                disabled={saving || !title.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Convert to Presentation
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right-Rail Enhancement Tools */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Need a jumpstart?
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Enhance your presentation with these tools
                </p>

                <div className="space-y-3">
                  {/* Apply Persona */}
                  <button
                    onClick={() => router.push('/coming-soon')}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <UserCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Apply Persona</div>
                      <div className="text-xs text-gray-500 mt-1">Coming Soon</div>
                    </div>
                  </button>

                  {/* AI Helper */}
                  <button
                    onClick={() => router.push('/coming-soon')}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">AI Helper</div>
                      <div className="text-xs text-gray-500 mt-1">Coming Soon</div>
                    </div>
                  </button>

                  {/* Start from Previous Deck */}
                  <button
                    onClick={() => router.push('/coming-soon')}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Start from Previous Deck</div>
                      <div className="text-xs text-gray-500 mt-1">Coming Soon</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


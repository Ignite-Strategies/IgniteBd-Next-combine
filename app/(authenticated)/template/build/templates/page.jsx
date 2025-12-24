'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { extractVariables } from '@/lib/templateVariables';
import TemplateTestService from '@/lib/services/templateTestService';

export default function TemplatesPage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [existingTemplates, setExistingTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState({ content: '', subjectLine: '' });
  const [form, setForm] = useState({
    title: '',
    relationship: '',
    typeOfPerson: '',
    whyReachingOut: '',
    whatWantFromThem: '',
    timeSinceConnected: '',
    timeHorizon: '',
    knowledgeOfBusiness: false,
    myBusinessDescription: '',
    desiredOutcome: '',
  });
  const [extractedVariables, setExtractedVariables] = useState([]);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('select'); // 'select' | 'preview'

  useEffect(() => {
    if (companyHQId) {
      loadExistingTemplates();
    }
  }, [companyHQId]);

  const loadExistingTemplates = async () => {
    if (!companyHQId) return;
    
    setLoadingTemplates(true);
    try {
      const response = await api.get(`/api/template/saved?companyHQId=${companyHQId}`);
      if (response.data?.success && response.data?.templates) {
        setExistingTemplates(response.data.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load existing templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template.id);
    setPreview({
      content: template.content,
      subjectLine: '',
    });
    const vars = extractVariables(template.content);
    setExtractedVariables(vars);
    
    if (template.template_bases) {
      const base = template.template_bases;
      setForm({
        title: base.title,
        relationship: base.relationship,
        typeOfPerson: base.typeOfPerson,
        whyReachingOut: base.whyReachingOut,
        whatWantFromThem: base.whatWantFromThem || '',
        timeSinceConnected: base.timeSinceConnected || '',
        timeHorizon: base.timeHorizon || '',
        knowledgeOfBusiness: base.knowledgeOfBusiness || false,
        myBusinessDescription: base.myBusinessDescription || '',
        desiredOutcome: base.desiredOutcome || '',
      });
    }
    setStep('preview');
  };

  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => setStep('select')}
              className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to templates
            </button>
            <h1 className="text-3xl font-semibold text-gray-900">Edit Template</h1>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Line (Optional)
              </label>
              <input
                type="text"
                value={preview.subjectLine || ''}
                onChange={(e) => setPreview({ ...preview, subjectLine: e.target.value })}
                placeholder="e.g., Quick check-in"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Template Content</h2>
              <textarea
                value={preview.content}
                onChange={(e) => {
                  setPreview({ ...preview, content: e.target.value });
                  const vars = extractVariables(e.target.value);
                  setExtractedVariables(vars);
                }}
                rows={12}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            {preview.content && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Preview (with sample data)</h2>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {TemplateTestService.generatePreview(preview.content, { formData: form }).hydratedContent}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => router.push('/template/saved')}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700"
              >
                Use This Template
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/template/build')}
            className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to choices
          </button>
          <h1 className="text-3xl font-semibold text-gray-900">Choose Existing Template</h1>
          <p className="mt-2 text-sm text-gray-600">
            Select a template you've already built
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {loadingTemplates ? (
            <div className="text-center py-8 text-gray-500">Loading templates...</div>
          ) : existingTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No templates found.</p>
              <p className="text-sm mt-2">Create a template first using Manual, Quick Idea, or Relationship Helper.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {existingTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-gray-900">
                    {template.template_bases?.title || 'Untitled Template'}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {template.template_bases?.typeOfPerson} • {template.template_bases?.relationship}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 line-clamp-2">
                    {template.content.substring(0, 100)}...
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


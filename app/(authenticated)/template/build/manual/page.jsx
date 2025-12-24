'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { extractVariables } from '@/lib/templateVariables';

// Prevent prerendering - this page requires client-side state
export const dynamic = 'force-dynamic';

const AVAILABLE_VARIABLES = [
  { name: 'firstName', description: "Contact's first name" },
  { name: 'lastName', description: "Contact's last name" },
  { name: 'companyName', description: "Contact's current company" },
  { name: 'title', description: "Contact's job title" },
  { name: 'timeSinceConnected', description: "Time since last connected" },
  { name: 'myBusinessName', description: "Your business name" },
  { name: 'myRole', description: "Your name/role" },
];

export default function ManualTemplatePage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [manualContent, setManualContent] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [extractedVariables, setExtractedVariables] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (manualContent) {
      const vars = extractVariables(manualContent);
      setExtractedVariables(vars);
    }
  }, [manualContent]);

  const insertVariable = (variableName) => {
    const textarea = document.querySelector('[name="manualContent"]');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = manualContent;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const variable = `{{${variableName}}}`;
      setManualContent(before + variable + after);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setManualContent(prev => prev + `{{${variableName}}}`);
    }
  };

  const handleSave = async () => {
    if (!manualContent.trim()) {
      setError('Please enter template content');
      return;
    }

    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      // Create template base
      const baseResponse = await api.post('/api/template/build', {
        companyHQId,
        title: 'Manual Template',
        relationship: 'WARM',
        typeOfPerson: 'PROSPECT',
        whyReachingOut: 'Manual template',
        whatWantFromThem: null,
      });

      if (baseResponse.data?.success && baseResponse.data?.templateBase) {
        // Save template
        const saveResponse = await api.post('/api/template/save', {
          templateBaseId: baseResponse.data.templateBase.id,
          content: manualContent.trim(),
          subjectLine: subjectLine.trim() || null,
          mode: 'MANUAL',
          companyHQId,
        });

        if (saveResponse.data?.success) {
          setSuccess(true);
          setTimeout(() => {
            router.push('/template/saved');
          }, 1500);
        } else {
          throw new Error('Failed to save template');
        }
      } else {
        throw new Error('Failed to create template base');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save template');
      setSaving(false);
    }
  };

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
          <h1 className="text-3xl font-semibold text-gray-900">Manual Template</h1>
          <p className="mt-2 text-sm text-gray-600">
            Type your message and insert variables as needed
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Template saved successfully! Redirecting...
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Line (Optional)
            </label>
            <input
              type="text"
              value={subjectLine}
              onChange={(e) => setSubjectLine(e.target.value)}
              placeholder="e.g., Quick check-in"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Message <span className="text-red-500">*</span>
            </label>
            <textarea
              name="manualContent"
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              placeholder="Type your message here. Use the buttons below to insert variables like {{firstName}} or {{companyName}}."
              rows={12}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">Insert variables:</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    onClick={() => insertVariable(variable.name)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-mono text-gray-700 hover:bg-gray-50"
                    title={variable.description}
                  >
                    {`{{${variable.name}}}`}
                  </button>
                ))}
              </div>
            </div>
            {extractedVariables.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Detected variables:</p>
                <div className="flex flex-wrap gap-2">
                  {extractedVariables.map((variable) => (
                    <span
                      key={variable.name}
                      className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-mono text-blue-800"
                    >
                      {`{{${variable.name}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview disabled to prevent build errors */}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/template/build')}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !manualContent.trim()}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

// Prevent prerendering - this page requires client-side state
export const dynamic = 'force-dynamic';

export default function QuickIdeaPage() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  const [idea, setIdea] = useState('');
  const [preview, setPreview] = useState({ content: '', subjectLine: '' });
  const [form, setForm] = useState({
    title: '',
    relationship: 'WARM',
    typeOfPerson: 'FRIEND_OF_FRIEND',
    whyReachingOut: '',
    whatWantFromThem: '',
  });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'preview'

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError('Please enter an idea first');
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const response = await api.post('/api/template/generate-quick', {
        idea: idea.trim(),
      });

      if (response.data?.success) {
        setPreview({
          content: response.data.template,
          subjectLine: '',
        });
        
        if (response.data.inferred) {
          const inferred = response.data.inferred;
          const relationshipLabels = {
            COLD: 'Cold Outreach',
            WARM: 'Warm Outreach',
            ESTABLISHED: 'Friend/Contact',
            DORMANT: 'Reconnection',
          };
          const title = relationshipLabels[inferred.relationship] || 'Quick Note';
          
          setForm({
            title,
            relationship: inferred.relationship || 'WARM',
            typeOfPerson: 'FRIEND_OF_FRIEND',
            whyReachingOut: inferred.intent || idea.trim(),
            whatWantFromThem: inferred.ask || '',
          });
        }
        
        setStep('preview');
      } else {
        throw new Error('Failed to generate template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!preview.content?.trim()) {
      setError('No content to save');
      return;
    }

    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const baseResponse = await api.post('/api/template/build', {
        companyHQId,
        title: form.title || 'Quick Note',
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut || idea.trim(),
        whatWantFromThem: form.whatWantFromThem || null,
      });

      if (baseResponse.data?.success && baseResponse.data?.templateBase) {
        const saveResponse = await api.post('/api/template/save', {
          templateBaseId: baseResponse.data.templateBase.id,
          content: preview.content.trim(),
          subjectLine: preview.subjectLine?.trim() || null,
          mode: 'AI',
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

  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => setStep('form')}
              className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to form
            </button>
            <h1 className="text-3xl font-semibold text-gray-900">Preview Template</h1>
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
                value={preview.subjectLine || ''}
                onChange={(e) => setPreview({ ...preview, subjectLine: e.target.value })}
                placeholder="e.g., Quick check-in"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Note Template</h2>
              <textarea
                value={preview.content}
                onChange={(e) => setPreview({ ...preview, content: e.target.value })}
                rows={12}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            {/* Preview disabled to prevent build errors */}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('form')}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? 'Saving...' : 'Save Template'}
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
            onClick={() => router.push('/template/build/ai')}
            className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to AI options
          </button>
          <h1 className="text-3xl font-semibold text-gray-900">Quick Idea</h1>
          <p className="mt-2 text-sm text-gray-600">
            Describe your idea and AI will create the template quickly
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="rounded-md border border-purple-200 bg-purple-50 p-4">
              <p className="text-sm text-purple-700">
                <strong>Quick Note Builder:</strong> Describe what you want to say and we'll create a warm, friendly note with variables.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your idea
              </label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g., build me a quick note to a friend and tell him I want to meet"
                rows={6}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <p className="mt-2 text-xs text-gray-500">
                The AI will infer the relationship, what you want, and create a warm note with variables like {{firstName}}.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !idea.trim()}
              className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {generating ? 'Generating...' : 'Generate Quick Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


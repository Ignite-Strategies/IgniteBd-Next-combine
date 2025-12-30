'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * Clone Template Page
 * Select an existing template to clone
 */
function CloneTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect if no companyHQId in URL
  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/templates/create/clone?companyHQId=${stored}`);
      } else {
        router.push('/templates');
      }
    }
  }, [companyHQId, router]);

  // Log CompanyHQ from URL params
  useEffect(() => {
    if (companyHQId) {
      console.log('🏢 CompanyHQ from URL params:', {
        companyHQId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [companyHQId]);

  useEffect(() => {
    if (companyHQId) {
      loadTemplates();
    }
  }, [companyHQId]);

  const loadTemplates = async () => {
    if (!companyHQId) return;
    
    try {
      setLoading(true);
      console.log('🔄 Loading templates for clone:', { companyHQId });
      const response = await api.get(`/api/templates?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        const templates = response.data.templates || [];
        console.log(`✅ Loaded ${templates.length} templates for clone`);
        setTemplates(templates);
      }
    } catch (err) {
      console.error('❌ Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = (templateId) => {
    const params = new URLSearchParams({ cloneFrom: templateId });
    if (companyHQId) {
      params.append('companyHQId', companyHQId);
    }
    router.push(`/builder/template/new?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clone Template</h1>
            <p className="mt-1 text-sm text-gray-600">
              Select a template to clone as your starting point
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-gray-600">Loading templates...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">
            {error}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-gray-600">No templates found. Create your first template manually.</p>
            <button
              onClick={() => router.push(companyHQId ? `/builder/template/new?companyHQId=${companyHQId}` : '/builder/template/new')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Create Template
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
                onClick={() => handleClone(template.id)}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {template.title}
                </h3>
                {template.subject && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    Subject: {template.subject}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Created {new Date(template.createdAt).toLocaleDateString()}
                </p>
                <button className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  Clone Template
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CloneTemplatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CloneTemplateContent />
    </Suspense>
  );
}


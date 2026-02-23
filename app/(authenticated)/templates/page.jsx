'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import {
  FileCode,
  Plus,
  FileStack,
  Sparkles,
  Copy,
  FileText,
  CheckCircle,
  ChevronRight,
  Tag,
} from 'lucide-react';
import api from '@/lib/api';

/**
 * Template Home — mini dashboard (not just a fork).
 * Stats, quick actions, Library / Create / Content snips, optional recent templates.
 */
function TemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  const [templateCount, setTemplateCount] = useState(null);
  const [snipCount, setSnipCount] = useState(null);
  const [recentTemplates, setRecentTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyHQId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('companyHQId');
      if (stored) {
        router.replace(`/templates?companyHQId=${stored}`);
      }
    }
  }, [companyHQId, router]);

  useEffect(() => {
    if (!companyHQId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/api/template/saved?companyHQId=${companyHQId}`).then((r) => r.data).catch(() => ({ templates: [] })),
      api.get(`/api/outreach/content-snips?companyHQId=${companyHQId}`).then((r) => r.data).catch(() => ({ snips: [] })),
    ]).then(([tplRes, snipRes]) => {
      if (cancelled) return;
      const templates = tplRes?.templates || [];
      const snips = snipRes?.snips || [];
      setTemplateCount(templates.length);
      setSnipCount(snips.length);
      setRecentTemplates(templates.slice(0, 5));
    }).catch(() => {
      if (!cancelled) {
        setTemplateCount(0);
        setSnipCount(0);
        setRecentTemplates([]);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [companyHQId]);

  const baseUrl = companyHQId ? `?companyHQId=${companyHQId}` : '';
  const libraryUrl = `/templates/library-email${baseUrl ? `?companyHQId=${companyHQId}` : ''}`;
  const createUrl = `/templates/create${baseUrl ? `?companyHQId=${companyHQId}` : ''}`;
  const snippetsUrl = `/content-snips${baseUrl ? `?companyHQId=${companyHQId}` : ''}`;
  const variablesUrl = `/variables${baseUrl ? `?companyHQId=${companyHQId}` : ''}`;
  const personasUrl = '/outreach-personas';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Email Templates"
          subtitle="Manage templates, content snips, and variables for outreach."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(snippetsUrl)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <FileStack className="h-4 w-4" />
                Content snips
              </button>
              <button
                type="button"
                onClick={() => router.push(personasUrl)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <Tag className="h-4 w-4" />
                Persona Bank
              </button>
              <button
                type="button"
                onClick={() => router.push(libraryUrl)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <FileCode className="h-4 w-4" />
                View templates
              </button>
              <button
                type="button"
                onClick={() => router.push(createUrl)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Create new
              </button>
            </div>
          }
        />

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => router.push(libraryUrl)}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                <FileCode className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '—' : templateCount ?? 0}
                </p>
                <p className="text-sm text-gray-500">Templates</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => router.push(snippetsUrl)}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                <FileStack className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '—' : snipCount ?? 0}
                </p>
                <p className="text-sm text-gray-500">Content snips</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => router.push(variablesUrl)}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">—</p>
                <p className="text-sm text-gray-500">Variables (firstName, company, etc.)</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Variables fill per contact on send. Snips store the text; variables own the look.
            </p>
          </button>
        </div>

        {/* Quick actions — three cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div
            onClick={() => router.push(libraryUrl)}
            className="flex cursor-pointer flex-col rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-red-100">
              <FileCode className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">View / edit templates</h3>
            <p className="mt-1 text-sm text-gray-600">
              Browse and edit your existing email templates.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-red-600">
              View templates
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </div>

          <div
            onClick={() => router.push(createUrl)}
            className="flex cursor-pointer flex-col rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-red-100">
              <Plus className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Create new</h3>
            <p className="mt-1 text-sm text-gray-600">
              Manual, AI, or clone an existing template.
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-gray-400" /> Manual
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-gray-400" /> AI
              </li>
              <li className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-gray-400" /> Clone
              </li>
            </ul>
            <div className="mt-4 flex items-center text-sm font-medium text-red-600">
              Create new
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </div>

          <div
            onClick={() => router.push(snippetsUrl)}
            className="flex cursor-pointer flex-col rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm transition hover:border-amber-400 hover:shadow-md"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100">
              <FileStack className="h-7 w-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Content snips</h3>
            <p className="mt-1 text-sm text-gray-600">
              Reusable blocks (intent, CTA, etc.) that can contain variables. Use in templates as <code className="rounded bg-amber-100 px-1 text-xs">{'{{snippet:name}}'}</code>.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <CheckCircle className="h-4 w-4 text-amber-600" />
              Upload CSV or add manually
            </div>
            <div className="mt-4 flex items-center text-sm font-medium text-amber-700">
              Manage snips
              <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Recent templates */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent templates</h3>
              <p className="text-sm text-gray-500">
                {loading ? 'Loading…' : 'Your latest email templates.'}
              </p>
            </div>
            {recentTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => router.push(libraryUrl)}
                className="text-sm font-medium text-red-600 transition hover:text-red-700"
              >
                View all
              </button>
            )}
          </div>
          {recentTemplates.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
              No templates yet. Create your first one to get started.
            </div>
          ) : (
            <ul className="space-y-2">
              {recentTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/templates/library-email${baseUrl ? `?companyHQId=${companyHQId}` : ''}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 py-3 px-4 text-left text-sm transition hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">
                      {t.template_bases?.title || 'Untitled template'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-gray-600">Loading…</p>
          </div>
        </div>
      }
    >
      <TemplatesContent />
    </Suspense>
  );
}

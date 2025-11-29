'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Sparkles, Users, UserCircle, FileEdit, Trash2 } from 'lucide-react';
import api from '@/lib/api';

export default function PersonasPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState([]);
  const [companyHQId, setCompanyHQId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showBuildOptions, setShowBuildOptions] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Load from localStorage only - no auto-fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    if (!storedCompanyHQId) {
      setError('Company context is required');
      return;
    }

    // Only load from localStorage
    const cached = window.localStorage.getItem('personas');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setPersonas(parsed);
          setError(null);
        }
      } catch (error) {
        console.warn('Failed to parse cached personas', error);
        setError('Failed to load personas from cache');
      }
    } else {
      setError('No personas found. Click Sync to load from server.');
    }
  }, []);

  // Delete persona function
  const handleDelete = async (personaId) => {
    if (!confirm('Are you sure you want to delete this persona? This action cannot be undone.')) {
      return;
    }

    setDeletingId(personaId);
    try {
      // Try the artifacts route first (has DELETE endpoint)
      await api.delete(`/api/artifacts/personas/${personaId}`);
      
      // Remove from local state
      const updatedPersonas = personas.filter(p => p.id !== personaId);
      setPersonas(updatedPersonas);
      
      // Update localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('personas', JSON.stringify(updatedPersonas));
      }
    } catch (err) {
      console.error('Failed to delete persona:', err);
      alert(err.response?.data?.error || 'Failed to delete persona. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Manual sync function
  const handleSync = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      const response = await api.get(`/api/personas?companyHQId=${companyHQId}`);
      
      // API returns array directly
      const personasData = Array.isArray(response.data) ? response.data : [];
      setPersonas(personasData);
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('personas', JSON.stringify(personasData));
      }
      setError(null);
    } catch (err) {
      console.error('Failed to sync personas:', err);
      setError('Failed to sync personas. Please try again.');
    } finally {
      setSyncing(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              🧠 Personas
            </h1>
            <p className="text-gray-600">
              Define and manage your ideal buyers for tailored activation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing || !companyHQId}
              className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={() => setShowBuildOptions(!showBuildOptions)}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              {showBuildOptions ? 'Cancel' : 'Add Persona'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Build Options Fork */}
        {showBuildOptions && (
          <div className="mb-8 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50 p-8 shadow-lg">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">
              Choose How to Build Your Persona
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Build with AI */}
              <div
                onClick={() => router.push('/personas/builder?mode=ai')}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-md transition hover:shadow-lg hover:border-blue-300"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Build with AI</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Describe your ideal customer and AI will generate a detailed persona
                </p>
              </div>

              {/* Build from Contacts */}
              <div
                onClick={() => router.push('/personas/contact-select')}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-md transition hover:shadow-lg hover:border-green-300"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Build from Contacts</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Select any contact (prospects or clients) to build a persona
                </p>
              </div>

              {/* Build from Enrichment */}
              <div
                onClick={() => router.push('/contacts/enrich?returnTo=persona')}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-md transition hover:shadow-lg hover:border-orange-300"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-orange-100 p-2">
                    <UserCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Build from Enrichment</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Generate persona from LinkedIn profile or enriched contact data
                </p>
              </div>

              {/* Manual Build */}
              <div
                onClick={() => router.push('/personas/builder')}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-md transition hover:shadow-lg hover:border-red-300"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 p-2">
                    <FileEdit className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Manual Build</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Create a persona from scratch with full control
                </p>
              </div>
            </div>
          </div>
        )}

        {personas.length === 0 && !showBuildOptions ? (
          <div className="rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 p-12 text-center shadow-lg">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-100 p-6">
                <span className="text-5xl">🧠</span>
              </div>
            </div>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              Create Your First Persona
            </h2>
            <p className="mb-2 text-lg text-gray-700">
              Personas help you understand your ideal buyers
            </p>
            <p className="mb-8 text-gray-600">
              Define their goals, pain points, and how your offer aligns with their needs
            </p>
            <button
              onClick={() => setShowBuildOptions(true)}
              className="rounded-lg bg-red-600 px-8 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-red-700 hover:shadow-lg"
            >
              Get Started →
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {persona.name || 'Persona'}
                    </h3>
                    {persona.role && (
                      <p className="text-sm text-gray-500">{persona.role}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                  <Link
                    href={`/personas/builder?personaId=${persona.id}`}
                    className="text-sm font-semibold text-red-600 transition hover:text-red-700"
                  >
                    Edit
                  </Link>
                    <button
                      onClick={() => handleDelete(persona.id)}
                      disabled={deletingId === persona.id}
                      className="text-sm font-semibold text-gray-600 transition hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Delete persona"
                    >
                      {deletingId === persona.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {deletingId === persona.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {persona.industry && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Industry:</p>
                      <p className="text-gray-600">{persona.industry}</p>
                    </div>
                  )}
                  {persona.goals && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Goals:</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{persona.goals}</p>
                    </div>
                  )}
                  {persona.painPoints && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Pain Points:</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{persona.painPoints}</p>
                    </div>
                  )}
                  {persona.valuePropToPersona && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">What They Want:</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{persona.valuePropToPersona}</p>
                    </div>
                  )}
                  {persona.desiredOutcome && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Desired Outcome:</p>
                      <p className="text-gray-600">{persona.desiredOutcome}</p>
                    </div>
                  )}
                  {persona.alignmentScore !== null &&
                    persona.alignmentScore !== undefined && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-sm">
                          <span className="font-semibold text-gray-800">
                            Alignment Score:
                          </span>{' '}
                          <span className="text-blue-600 font-medium">{persona.alignmentScore}/100</span>
                        </p>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

export default function PersonasPage() {
  const [personas, setPersonas] = useState([]);
  const [companyHQId, setCompanyHQId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
            <Link
              href="/personas/builder"
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Persona
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {personas.length === 0 ? (
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
            <Link
              href="/personas/builder"
              className="rounded-lg bg-red-600 px-8 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-red-700 hover:shadow-lg"
            >
              Get Started →
            </Link>
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
                  <Link
                    href={`/personas/builder?personaId=${persona.id}`}
                    className="text-sm font-semibold text-red-600 transition hover:text-red-700"
                  >
                    Edit
                  </Link>
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


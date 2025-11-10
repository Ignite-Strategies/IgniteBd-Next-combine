'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

export default function PersonasPage() {
  const [personas, setPersonas] = useState([]);
  const [companyHQId, setCompanyHQId] = useState('');
  const [error, setError] = useState(null);

  // Load from localStorage immediately (always show page)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    // Try to load personas from localStorage first
    try {
      const storedPersonas = localStorage.getItem('personas');
      if (storedPersonas) {
        const parsed = JSON.parse(storedPersonas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPersonas(parsed);
          return; // We have data, show it immediately
        }
      }
    } catch (err) {
      console.warn('Failed to parse stored personas:', err);
    }
  }, []);

  // No hydration calls here - Growth Dashboard handles all hydration
  // This page just reads from localStorage

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

                <div className="space-y-2 text-sm text-gray-600">
                  {persona.industry && (
                    <p>
                      <span className="font-semibold text-gray-800">
                        Industry:
                      </span>{' '}
                      {persona.industry}
                    </p>
                  )}
                  {persona.goals && (
                    <p>
                      <span className="font-semibold text-gray-800">Goals:</span>{' '}
                      {persona.goals}
                    </p>
                  )}
                  {persona.painPoints && (
                    <p>
                      <span className="font-semibold text-gray-800">
                        Pain Points:
                      </span>{' '}
                      {persona.painPoints}
                    </p>
                  )}
                  {persona.desiredOutcome && (
                    <p>
                      <span className="font-semibold text-gray-800">
                        Desired Outcome:
                      </span>{' '}
                      {persona.desiredOutcome}
                    </p>
                  )}
                  {persona.alignmentScore !== null &&
                    persona.alignmentScore !== undefined && (
                      <p>
                        <span className="font-semibold text-gray-800">
                          Alignment Score:
                        </span>{' '}
                        {persona.alignmentScore}/100
                      </p>
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


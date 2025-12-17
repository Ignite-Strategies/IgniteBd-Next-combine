'use client';

import { useState, useEffect } from 'react';
import { UserCircle, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface Persona {
  id: string;
  personName?: string;
  title?: string;
  industry?: string;
  location?: string;
}

interface PersonaSearchProps {
  selectedPersona: Persona | null;
  onSelectPersona: (persona: Persona | null) => void;
}

export default function PersonaSearch({ selectedPersona, onSelectPersona }: PersonaSearchProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/personas?companyHQId=${companyHQId}`);
      if (response.data && Array.isArray(response.data)) {
        setPersonas(response.data);
      }
    } catch (err) {
      console.error('Error loading personas:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">Loading personas...</p>
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-8">
        <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-semibold text-gray-800 mb-2">No personas found</p>
        <p className="text-sm text-gray-500">
          Create personas first in the Personas section
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {personas.map((persona) => (
        <div
          key={persona.id}
          onClick={() => onSelectPersona(persona)}
          className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
            selectedPersona?.id === persona.id
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              checked={selectedPersona?.id === persona.id}
              onChange={() => onSelectPersona(persona)}
              className="mt-1"
            />
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">
                {persona.personName || persona.title || 'Untitled Persona'}
              </h4>
              {persona.title && (
                <p className="text-sm text-gray-600 mt-1">{persona.title}</p>
              )}
              {persona.industry && (
                <p className="text-sm text-gray-500 mt-1">Industry: {persona.industry}</p>
              )}
              {persona.location && (
                <p className="text-sm text-gray-500">Location: {persona.location}</p>
              )}
            </div>
            {selectedPersona?.id === persona.id && (
              <CheckCircle2 className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


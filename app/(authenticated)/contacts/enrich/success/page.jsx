'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  Sparkles,
  UserCircle,
  Mail,
  Phone,
  Building2,
  MapPin,
  Linkedin,
  Briefcase,
  ArrowLeft,
} from 'lucide-react';
import api from '@/lib/api';

export default function EnrichSuccessPage() {
  const router = useRouter();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get results from sessionStorage
    const storedResults = sessionStorage.getItem('enrichmentResults');
    if (storedResults) {
      try {
        const parsed = JSON.parse(storedResults);
        setResults(parsed);
      } catch (error) {
        console.error('Error parsing enrichment results:', error);
      }
    }
    setLoading(false);
  }, []);

  const handleAddToPersonaBuilder = async (contact) => {
    try {
      // Navigate to persona builder with contact data
      router.push(`/personas?contactId=${contact.id}`);
    } catch (error) {
      console.error('Error navigating to persona builder:', error);
      alert('Failed to navigate to persona builder');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
          <div className="text-gray-600">Preparing enrichment results</div>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-white p-8 shadow-lg text-center">
            <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              No Enrichment Results Found
            </h2>
            <p className="mb-6 text-gray-600">
              Please go back and try enriching again.
            </p>
            <button
              type="button"
              onClick={() => router.push('/contacts/view')}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              View Contacts
            </button>
          </div>
        </div>
      </div>
    );
  }

  const successfulResults = results.results?.filter((r) => r.success) || [];
  const failedResults = results.results?.filter((r) => !r.success) || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/contacts/view')}
            className="mb-4 flex items-center text-gray-600 transition hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Enrich
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-gray-900">
                ✨ Enrichment Complete
              </h1>
              <p className="text-lg text-gray-600">
                Results of your contact enrichment
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-2 text-sm text-gray-600">Total Contacts</div>
            <div className="text-3xl font-bold text-gray-900">{results.total || 0}</div>
          </div>
          <div className="rounded-xl bg-green-50 p-6 shadow-lg border-2 border-green-200">
            <div className="mb-2 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              Successful
            </div>
            <div className="text-3xl font-bold text-green-900">{results.successful || 0}</div>
          </div>
          <div className="rounded-xl bg-red-50 p-6 shadow-lg border-2 border-red-200">
            <div className="mb-2 flex items-center gap-2 text-sm text-red-700">
              <XCircle className="h-4 w-4" />
              Failed
            </div>
            <div className="text-3xl font-bold text-red-900">{results.failed || 0}</div>
          </div>
        </div>

        {/* Successful Results */}
        {successfulResults.length > 0 && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                ✅ Successfully Enriched ({successfulResults.length})
              </h2>
            </div>
            <div className="space-y-4">
              {successfulResults.map((result, index) => {
                const contact = result.contact;
                const enrichedData = result.enrichedData || {};
                return (
                  <div
                    key={index}
                    className="rounded-lg border-2 border-green-200 bg-green-50 p-6"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                          {contact.title && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Briefcase className="h-4 w-4 text-gray-400" />
                              <span>{contact.title}</span>
                            </div>
                          )}
                          {contact.companyName && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <span>{contact.companyName}</span>
                            </div>
                          )}
                          {(contact.city || contact.state || contact.country) && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>
                                {[contact.city, contact.state, contact.country]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                          {contact.linkedinUrl && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Linkedin className="h-4 w-4 text-gray-400" />
                              <a
                                href={contact.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                LinkedIn Profile
                              </a>
                            </div>
                          )}
                          {contact.seniority && (
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Seniority:</span> {contact.seniority}
                            </div>
                          )}
                          {contact.department && (
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Department:</span> {contact.department}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddToPersonaBuilder(contact)}
                          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
                        >
                          <UserCircle className="h-4 w-4" />
                          Add to Persona Builder
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/contacts/view`)}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          View Contact
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Failed Results */}
        {failedResults.length > 0 && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                ❌ Failed Enrichments ({failedResults.length})
              </h2>
            </div>
            <div className="space-y-4">
              {failedResults.map((result, index) => (
                <div
                  key={index}
                  className="rounded-lg border-2 border-red-200 bg-red-50 p-6"
                >
                  <div className="flex items-center gap-3">
                    <XCircle className="h-6 w-6 text-red-600" />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{result.email}</div>
                      <div className="text-sm text-red-600">{result.error || 'Enrichment failed'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/contacts/view')}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            View All Contacts
          </button>
          <button
            type="button"
            onClick={() => router.push('/personas')}
            className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700"
          >
            Go to Persona Builder
          </button>
        </div>
      </div>
    </div>
  );
}

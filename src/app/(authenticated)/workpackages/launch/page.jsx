'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Upload, Copy, Wrench, FileCheck } from 'lucide-react';
import api from '@/lib/api';

/**
 * Proposal Launcher Page
 * Entry point for creating proposals with 4 options
 */
export default function ProposalLauncherPage() {
  const router = useRouter();
  const [contactId, setContactId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedContacts = window.localStorage.getItem('contacts');
      if (cachedContacts) {
        try {
          const parsed = JSON.parse(cachedContacts);
          if (Array.isArray(parsed)) {
            setContacts(parsed);
          }
        } catch (error) {
          console.warn('Failed to parse cached contacts', error);
        }
      }
    }
  }, []);

  const availableContacts = contacts.filter((contact) => {
    if (!contactSearch) return true;
    const searchLower = contactSearch.toLowerCase();
    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const email = (contact.email || '').toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower);
  }).slice(0, 20);

  const handleSelectOption = (option) => {
    if (!contactId) {
      alert('Please select a contact first');
      return;
    }
    setSelectedOption(option);
    
    switch (option) {
      case 'csv':
        router.push(`/workpackages/assemble/csv?contactId=${contactId}`);
        break;
      case 'clone':
        router.push(`/workpackages/assemble/clone?contactId=${contactId}`);
        break;
      case 'templates':
        router.push(`/workpackages/assemble/templates?contactId=${contactId}`);
        break;
      case 'blank':
        router.push(`/workpackages/assemble/blank?contactId=${contactId}`);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Proposal</h1>
            <p className="mt-1 text-sm text-gray-600">
              Choose how you want to build your proposal
            </p>
          </div>
        </div>

        {/* Contact Selection */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Client Contact <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          />
          {contactSearch && availableContacts.length > 0 && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {availableContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    setContactId(contact.id);
                    setContactSearch(`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    contactId === contact.id ? 'bg-red-50' : ''
                  }`}
                >
                  {contact.firstName} {contact.lastName} - {contact.email}
                </button>
              ))}
            </div>
          )}
          {contactId && (
            <div className="mt-3 rounded-lg border-2 border-red-200 bg-red-50 p-3">
              <p className="font-semibold text-gray-900">
                {contacts.find(c => c.id === contactId)?.firstName} {contacts.find(c => c.id === contactId)?.lastName}
              </p>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="space-y-4">
          <button
            onClick={() => handleSelectOption('csv')}
            disabled={!contactId}
            className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-red-100 p-3">
                <Upload className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">From CSV</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Upload a CSV with phases and deliverables
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelectOption('clone')}
            disabled={!contactId}
            className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-red-100 p-3">
                <Copy className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Clone Previous Proposal</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Duplicate phases and items from an existing proposal
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelectOption('templates')}
            disabled={!contactId}
            className="w-full rounded-lg border-2 border-red-600 bg-red-50 p-6 text-left transition-all hover:border-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-red-600 p-3">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Use Templates (Recommended)</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Choose phases and deliverables from reusable templates
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelectOption('blank')}
            disabled={!contactId}
            className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-red-100 p-3">
                <Wrench className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Start Blank</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Manually add phases and deliverables
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}


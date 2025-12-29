'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Check, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { useOwner } from '@/hooks/useOwner';
import api from '@/lib/api';

export default function CompanyHubPage() {
  const router = useRouter();
  const { companyHQId, hydrated: ownerHydrated } = useOwner();
  
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdCompany, setCreatedCompany] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }

    if (!companyHQId) {
      setError('Company context is required. Please refresh the page.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(false);

    try {
      // Create the company
      const response = await api.post('/api/companies', {
        companyHQId,
        companyName: companyName.trim(),
        address: address.trim() || undefined,
        industry: industry.trim() || undefined,
        website: website.trim() || undefined,
      });

      if (response.data?.success && response.data.company) {
        const newCompany = response.data.company;
        setCreatedCompany(newCompany);

        // Optionally associate with contact if one is selected
        if (selectedContactId) {
          try {
            await api.put(`/api/contacts/${selectedContactId}`, {
              companyId: newCompany.id,
            });
          } catch (assocError) {
            console.error('Failed to associate contact:', assocError);
            // Don't fail the whole operation if association fails
            setError('Company created but failed to associate with contact. You can associate it manually later.');
          }
        }

        setSuccess(true);
        // Reset form
        setCompanyName('');
        setAddress('');
        setIndustry('');
        setWebsite('');
        setSelectedContactId(null);
        setSelectedContact(null);
      } else {
        setError(response.data?.error || 'Failed to create company');
      }
    } catch (err) {
      console.error('Failed to create company:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const handleContactSelect = (contact, company) => {
    setSelectedContactId(contact?.id || null);
    setSelectedContact(contact);
  };

  const handleReset = () => {
    setSuccess(false);
    setCreatedCompany(null);
    setError(null);
  };

  if (!ownerHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="🏢 Company Hub"
            subtitle="Manage prospect and client companies"
            backTo="/growth-dashboard"
            backLabel="Back to Growth Dashboard"
          />
          <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="🏢 Company Hub"
          subtitle="Add a company and optionally associate it with a contact"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {success && createdCompany ? (
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check className="h-8 w-8" />
                </div>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">
                Company Created!
              </h2>
              <p className="mb-4 text-gray-600">
                <strong>{createdCompany.companyName}</strong> has been created successfully.
                {selectedContactId && ' It has been associated with the selected contact.'}
              </p>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Add Another Company
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/people')}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Go to People Hub
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company name"
                  required
                  disabled={creating}
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company address"
                  disabled={creating}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="industry" className="block text-sm font-semibold text-gray-700 mb-2">
                    Industry
                  </label>
                  <input
                    type="text"
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Technology, Legal"
                    disabled={creating}
                  />
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-semibold text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                    disabled={creating}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Associate with Contact (Optional)
                </label>
                <ContactSelector
                  contactId={selectedContactId}
                  onContactSelect={handleContactSelect}
                  selectedContact={selectedContact}
                  showLabel={false}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Search for a contact to associate this company with
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => router.push('/growth-dashboard')}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !companyName.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Add Company
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


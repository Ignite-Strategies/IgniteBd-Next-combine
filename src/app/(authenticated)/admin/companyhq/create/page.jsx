'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, Save } from 'lucide-react';
import api from '@/lib/api';

export default function CreateCompanyHQ() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    ownerId: '',
    contactOwnerId: '',
    managerId: '',
  });
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Prepare payload (only include non-empty fields)
      const payload = {
        companyName: formData.companyName.trim(),
      };

      if (formData.ownerId.trim()) {
        payload.ownerId = formData.ownerId.trim();
      }
      if (formData.contactOwnerId.trim()) {
        payload.contactOwnerId = formData.contactOwnerId.trim();
      }
      if (formData.managerId.trim()) {
        payload.managerId = formData.managerId.trim();
      }

      const response = await api.post('/api/admin/companyhq/create', payload);

      if (response.data?.success) {
        // Set the new CompanyHQ as active tenant
        const newCompanyHQId = response.data.companyHQ?.id;
        if (newCompanyHQId) {
          localStorage.setItem('companyHQId', newCompanyHQId);
        }
        // Redirect to dashboard
        router.push('/growth-dashboard');
      } else {
        setError(response.data?.error || 'Failed to create CompanyHQ');
      }
    } catch (err) {
      console.error('Error creating CompanyHQ:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create CompanyHQ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Switchboard
          </button>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create CompanyHQ</h1>
              <p className="text-gray-600">SuperAdmin - Create a new tenant</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-lg bg-white p-8 shadow">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="companyName"
                required
                value={formData.companyName}
                onChange={(e) =>
                  setFormData({ ...formData, companyName: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Enter company name"
              />
            </div>

            {/* Owner ID */}
            <div>
              <label htmlFor="ownerId" className="block text-sm font-medium text-gray-700">
                Owner ID (optional)
              </label>
              <input
                type="text"
                id="ownerId"
                value={formData.ownerId}
                onChange={(e) =>
                  setFormData({ ...formData, ownerId: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Owner database ID"
              />
              <p className="mt-1 text-xs text-gray-500">
                Link this CompanyHQ to an Owner
              </p>
            </div>

            {/* Contact Owner ID */}
            <div>
              <label htmlFor="contactOwnerId" className="block text-sm font-medium text-gray-700">
                Contact Owner ID (optional)
              </label>
              <input
                type="text"
                id="contactOwnerId"
                value={formData.contactOwnerId}
                onChange={(e) =>
                  setFormData({ ...formData, contactOwnerId: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Contact database ID"
              />
              <p className="mt-1 text-xs text-gray-500">
                Link this CompanyHQ to a Contact (Contact-owned HQ)
              </p>
            </div>

            {/* Manager ID */}
            <div>
              <label htmlFor="managerId" className="block text-sm font-medium text-gray-700">
                Manager ID (optional)
              </label>
              <input
                type="text"
                id="managerId"
                value={formData.managerId}
                onChange={(e) =>
                  setFormData({ ...formData, managerId: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Manager Owner database ID"
              />
              <p className="mt-1 text-xs text-gray-500">
                Assign a Manager (Owner) to this CompanyHQ
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.companyName.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Create CompanyHQ
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <h3 className="mb-2 font-semibold text-blue-900">Note:</h3>
          <p className="text-sm text-blue-800">
            At least one of Owner ID, Contact Owner ID, or Manager ID must be provided.
            Company Name is required.
          </p>
        </div>
      </div>
    </div>
  );
}


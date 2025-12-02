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
    whatYouDo: '',
    companyStreet: '',
    companyCity: '',
    companyState: '',
    companyWebsite: '',
    industry: '',
    annualRevenue: '',
    yearsInBusiness: '',
    teamSize: '',
  });
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Map form fields to API payload (matching /api/company/upsert structure)
      const payload = {
        companyName: formData.companyName.trim(),
        whatYouDo: formData.whatYouDo || null,
        companyStreet: formData.companyStreet || null,
        companyCity: formData.companyCity || null,
        companyState: formData.companyState || null,
        companyWebsite: formData.companyWebsite || null,
        companyIndustry: formData.industry || null,
        companyAnnualRev: formData.annualRevenue || null,
        yearsInBusiness: formData.yearsInBusiness || null,
        teamSize: formData.teamSize || null,
        // ownerId will be set automatically to SuperAdmin's owner ID in the API route
      };

      const response = await api.post('/api/admin/companyhq/create', payload);

      if (response.data?.success) {
        // Set the new CompanyHQ as active tenant
        const newCompanyHQId = response.data.companyHQ?.id;
        if (newCompanyHQId) {
          localStorage.setItem('companyHQId', newCompanyHQId);
        }
        // Redirect to switchboard
        router.push('/superadmin/switchboard');
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
            onClick={() => router.push('/admin/switchboard')}
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
                name="companyName"
                required
                value={formData.companyName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Enter company name"
              />
            </div>

            {/* What You Do */}
            <div>
              <label htmlFor="whatYouDo" className="block text-sm font-medium text-gray-700">
                What You Do <span className="text-red-500">*</span>
              </label>
              <textarea
                id="whatYouDo"
                name="whatYouDo"
                required
                rows={3}
                value={formData.whatYouDo}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Describe what your company does"
              />
            </div>

            {/* Street Address */}
            <div>
              <label htmlFor="companyStreet" className="block text-sm font-medium text-gray-700">
                Street Address
              </label>
              <input
                type="text"
                id="companyStreet"
                name="companyStreet"
                value={formData.companyStreet}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Street address"
              />
            </div>

            {/* City and State */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="companyCity" className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  id="companyCity"
                  name="companyCity"
                  value={formData.companyCity}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="City"
                />
              </div>

              <div>
                <label htmlFor="companyState" className="block text-sm font-medium text-gray-700">
                  State / Zip
                </label>
                <input
                  type="text"
                  id="companyState"
                  name="companyState"
                  value={formData.companyState}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="State, ZIP"
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700">
                Website
              </label>
              <input
                type="url"
                id="companyWebsite"
                name="companyWebsite"
                value={formData.companyWebsite}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="https://www.example.com"
                pattern="https?://.*"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter full URL with https:// (optional)
              </p>
            </div>

            {/* Years in Business and Industry */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-gray-700">
                  Years in Business
                </label>
                <select
                  id="yearsInBusiness"
                  name="yearsInBusiness"
                  value={formData.yearsInBusiness}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Select years</option>
                  <option value="0-1">0-1 years</option>
                  <option value="2-5">2-5 years</option>
                  <option value="6-10">6-10 years</option>
                  <option value="11-20">11-20 years</option>
                  <option value="20+">20+ years</option>
                </select>
              </div>

              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                  Industry <span className="text-red-500">*</span>
                </label>
                <select
                  id="industry"
                  name="industry"
                  required
                  value={formData.industry}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Select industry</option>
                  <option value="legal">Legal Services</option>
                  <option value="consulting">Consulting</option>
                  <option value="technology">Technology</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="finance">Finance</option>
                  <option value="retail">Retail</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Annual Revenue and Team Size */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="annualRevenue" className="block text-sm font-medium text-gray-700">
                  Annual Revenue
                </label>
                <select
                  id="annualRevenue"
                  name="annualRevenue"
                  value={formData.annualRevenue}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Select revenue range</option>
                  <option value="0-100k">$0 - $100K</option>
                  <option value="100k-500k">$100K - $500K</option>
                  <option value="500k-1m">$500K - $1M</option>
                  <option value="1m-5m">$1M - $5M</option>
                  <option value="5m-10m">$5M - $10M</option>
                  <option value="10m+">$10M+</option>
                </select>
              </div>

              <div>
                <label htmlFor="teamSize" className="block text-sm font-medium text-gray-700">
                  Team Size <span className="text-red-500">*</span>
                </label>
                <select
                  id="teamSize"
                  name="teamSize"
                  required
                  value={formData.teamSize}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Select team size</option>
                  <option value="just-me">Just Me</option>
                  <option value="2-10">2-10 People</option>
                  <option value="11-50">11-50 People</option>
                  <option value="51-200">51-200 People</option>
                  <option value="200+">200+ People</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/admin/switchboard')}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.companyName.trim() || !formData.whatYouDo.trim() || !formData.industry || !formData.teamSize}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
            This CompanyHQ will be automatically linked to your SuperAdmin account as the owner.
            The owner can be changed later if needed.
          </p>
        </div>
      </div>
    </div>
  );
}

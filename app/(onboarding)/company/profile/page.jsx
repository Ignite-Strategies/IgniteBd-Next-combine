'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

export default function CompanyProfilePage() {
  const router = useRouter();
  const { owner, companyHQId: ownerCompanyHQId } = useOwner(); // CRITICAL: Use hook exclusively - NO API calls to hydrate
  const [formData, setFormData] = useState({
    companyName: '',
    whatYouDo: '',
    companyStreet: '',
    companyCity: '',
    companyState: '',
    companyWebsite: '',
    yearsInBusiness: '',
    industry: '',
    annualRevenue: '',
    teamSize: '',
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingCompany, setExistingCompany] = useState(null);

  // Check if company already exists on mount - if so, redirect
  // CRITICAL: Owner must come from hook (already hydrated on welcome) - NO API calls to hydrate
  useEffect(() => {
    const checkExistingCompany = async () => {
      try {
        // First check localStorage
        const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
        
        if (companyHQId) {
          // Company exists - redirect to success/dashboard
          router.push('/company/create-success');
          return;
        }

        // If no localStorage, check owner from hook
        if (owner && ownerCompanyHQId) {
          // Company exists - redirect
          router.push('/company/create-success');
          return;
        }
      } catch (err) {
        console.warn('Could not check for existing company:', err);
        // Continue with empty form
      } finally {
        setChecking(false);
      }
    };

    checkExistingCompany();
  }, [router, owner, ownerCompanyHQId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      // Use upsert API which handles both create and update
      const response = await api.put('/api/company/upsert', {
        companyName: formData.companyName,
        whatYouDo: formData.whatYouDo,
        companyStreet: formData.companyStreet,
        companyCity: formData.companyCity,
        companyState: formData.companyState,
        companyWebsite: formData.companyWebsite,
        companyIndustry: formData.industry,
        companyAnnualRev: formData.annualRevenue || null,
        yearsInBusiness: formData.yearsInBusiness || null,
        teamSize: formData.teamSize,
      });

      const companyHQ = response.data?.companyHQ;
      if (companyHQ) {
        localStorage.setItem('companyHQId', companyHQ.id);
        localStorage.setItem('companyHQ', JSON.stringify(companyHQ));
      }

      // CRITICAL: NO API calls to hydrate - owner data will refresh naturally via hook on next page load
      // Just update localStorage from response - hook will pick it up

      router.push('/company/create-success');
    } catch (error) {
      console.error('Company save error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to save company';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="Ignite Strategies"
            width={64}
            height={64}
            className="mx-auto mb-6 h-16 w-16 object-contain"
            priority
          />
          <h1 className="text-4xl font-bold text-white mb-4">Create Your Company</h1>
          <p className="text-white/80 text-lg">
            Tell us about your business to get started
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/20 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-white mb-2">
                Company Name *
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                placeholder="Enter your company name"
                required
              />
            </div>

            <div>
              <label htmlFor="whatYouDo" className="block text-sm font-medium text-white mb-2">
                What You Do *
              </label>
              <textarea
                id="whatYouDo"
                name="whatYouDo"
                value={formData.whatYouDo}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                placeholder="Describe what your company does"
                required
              />
            </div>

            <div>
              <label htmlFor="companyStreet" className="block text-sm font-medium text-white mb-2">
                Street Address
              </label>
              <input
                type="text"
                id="companyStreet"
                name="companyStreet"
                value={formData.companyStreet}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                placeholder="Street address"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="companyCity" className="block text-sm font-medium text-white mb-2">
                  City
                </label>
                <input
                  type="text"
                  id="companyCity"
                  name="companyCity"
                  value={formData.companyCity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  placeholder="City"
                />
              </div>

              <div>
                <label htmlFor="companyState" className="block text-sm font-medium text-white mb-2">
                  State / Zip
                </label>
                <input
                  type="text"
                  id="companyState"
                  name="companyState"
                  value={formData.companyState}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  placeholder="State, ZIP"
                />
              </div>
            </div>

            <div>
              <label htmlFor="companyWebsite" className="block text-sm font-medium text-white mb-2">
                Website
              </label>
              <input
                type="url"
                id="companyWebsite"
                name="companyWebsite"
                value={formData.companyWebsite}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                placeholder="https://www.example.com"
                pattern="https?://.*"
              />
              <p className="text-white/60 text-xs mt-2">
                Enter full URL with https:// (optional field - leave empty if not needed)
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-white mb-2">
                  Years in Business
                </label>
                <select
                  id="yearsInBusiness"
                  name="yearsInBusiness"
                  value={formData.yearsInBusiness}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                >
                  <option value="" className="bg-gray-800">Select years</option>
                  <option value="0-1" className="bg-gray-800">0-1 years</option>
                  <option value="2-5" className="bg-gray-800">2-5 years</option>
                  <option value="6-10" className="bg-gray-800">6-10 years</option>
                  <option value="11-20" className="bg-gray-800">11-20 years</option>
                  <option value="20+" className="bg-gray-800">20+ years</option>
                </select>
              </div>

              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-white mb-2">
                  Industry *
                </label>
                <select
                  id="industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  required
                >
                  <option value="" className="bg-gray-800">Select industry</option>
                  <option value="legal" className="bg-gray-800">Legal Services</option>
                  <option value="consulting" className="bg-gray-800">Consulting</option>
                  <option value="technology" className="bg-gray-800">Technology</option>
                  <option value="healthcare" className="bg-gray-800">Healthcare</option>
                  <option value="finance" className="bg-gray-800">Finance</option>
                  <option value="retail" className="bg-gray-800">Retail</option>
                  <option value="manufacturing" className="bg-gray-800">Manufacturing</option>
                  <option value="other" className="bg-gray-800">Other</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="annualRevenue" className="block text-sm font-medium text-white mb-2">
                  Annual Revenue
                </label>
                <select
                  id="annualRevenue"
                  name="annualRevenue"
                  value={formData.annualRevenue}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                >
                  <option value="" className="bg-gray-800">Select revenue range</option>
                  <option value="0-100k" className="bg-gray-800">$0 - $100K</option>
                  <option value="100k-500k" className="bg-gray-800">$100K - $500K</option>
                  <option value="500k-1m" className="bg-gray-800">$500K - $1M</option>
                  <option value="1m-5m" className="bg-gray-800">$1M - $5M</option>
                  <option value="5m-10m" className="bg-gray-800">$5M - $10M</option>
                  <option value="10m+" className="bg-gray-800">$10M+</option>
                </select>
              </div>

              <div>
                <label htmlFor="teamSize" className="block text-sm font-medium text-white mb-2">
                  Team Size *
                </label>
                <select
                  id="teamSize"
                  name="teamSize"
                  value={formData.teamSize}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  required
                >
                  <option value="" className="bg-gray-800">Select team size</option>
                  <option value="just-me" className="bg-gray-800">Just Me</option>
                  <option value="2-10" className="bg-gray-800">2-10 People</option>
                  <option value="11-50" className="bg-gray-800">11-50 People</option>
                  <option value="51-200" className="bg-gray-800">51-200 People</option>
                  <option value="200+" className="bg-gray-800">200+ People</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/company/create-or-choose')}
                className="flex-1 px-4 py-2 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-all text-sm"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Creating…' : 'Create Company →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


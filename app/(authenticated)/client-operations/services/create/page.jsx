'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Save, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

const SERVICE_TYPES = [
  'Strategy',
  'Implementation',
  'Training',
  'Support',
  'Consulting',
  'Design',
  'Development',
  'Content',
  'Other',
];

export default function CreateServicePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    type: 'Other',
    description: '',
    price: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Save to localStorage for now (TODO: Create API endpoint)
      const savedServices = JSON.parse(
        localStorage.getItem('savedServices') || '[]'
      );
      
      const newService = {
        id: `service-${Date.now()}`,
        name: formData.name.trim(),
        type: formData.type,
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        createdAt: new Date().toISOString(),
      };

      savedServices.push(newService);
      localStorage.setItem('savedServices', JSON.stringify(savedServices));

      // Navigate back to proposal create or services list
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      if (returnTo) {
        router.push(returnTo);
      } else {
        router.push('/client-operations/proposals/create');
      }
    } catch (err) {
      console.error('Error saving service:', err);
      setError('Failed to save service. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Service"
          subtitle="Create a reusable service/deliverable that can be added to proposals"
          backTo="/client-operations/proposals/create"
          backLabel="Back to Create Proposal"
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Service Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Strategy Consulting, CLE Deck Creation"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                placeholder="Describe what this service includes..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Unit Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                This is the price per unit. Quantity can be adjusted when adding to proposals.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Service'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState } from 'react';

const defaultCompanyHQId =
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_HQ_ID || '';

export default function ProductCreatePage() {
  const [form, setForm] = useState({
    name: '',
    description: '',
    valueProp: '',
    companyHQId: defaultCompanyHQId,
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          valueProp: form.valueProp,
          companyHQId: form.companyHQId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create product');
      }

      setFeedback({
        name: data.name,
        valueProp: data.valueProp,
        companyHQId: data.companyHQId,
        createdAt: data.createdAt,
      });
      setForm({
        name: '',
        description: '',
        valueProp: '',
        companyHQId: defaultCompanyHQId,
      });
    } catch (err) {
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Create Product
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Capture a product&apos;s core value proposition to power Business
          Intelligence alignment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Product Name
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Ignite CRM Automation"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Optional supporting details that describe the product experience."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Value Proposition
          </label>
          <textarea
            name="valueProp"
            value={form.valueProp}
            onChange={handleChange}
            placeholder="Turn follow-ups into closed deals automatically."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            CompanyHQ ID
            <span className="ml-1 text-xs text-gray-500">
              (leave blank to use default tenant)
            </span>
          </label>
          <input
            name="companyHQId"
            value={form.companyHQId}
            onChange={handleChange}
            placeholder="company-hq-id"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          {loading ? 'Saving…' : 'Create Product'}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">Product created successfully.</p>
          <p className="mt-1">
            <span className="font-medium text-green-900">Name:</span>{' '}
            {feedback.name}
          </p>
          {feedback.valueProp && (
            <p className="mt-1">
              <span className="font-medium text-green-900">Value Prop:</span>{' '}
              {feedback.valueProp}
            </p>
          )}
          {feedback.companyHQId && (
            <p className="mt-1 text-green-900">
              <span className="font-medium">CompanyHQ:</span>{' '}
              {feedback.companyHQId}
            </p>
          )}
        </div>
      )}
    </div>
  );
}


'use client';

import { useEffect, useState } from 'react';

const defaultCompanyHQId =
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_HQ_ID || '';

export default function PersonaCreatePage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: '',
    title: '',
    industry: '',
    goals: '',
    painPoints: '',
    desiredOutcome: '',
    valuePropToPersona: '',
    productId: '',
    companyHQId: defaultCompanyHQId,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const companyHQId = form.companyHQId;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const query = companyHQId
          ? `?companyHQId=${encodeURIComponent(companyHQId)}`
          : '';
        const res = await fetch(`/api/products${query}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error('Failed to load products');
        }
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [companyHQId]);

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
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          alignmentScore: undefined, // allow server to calculate
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create persona');
      }

      setResult({
        personaId: data.personaId,
        alignmentScore: data.alignmentScore,
        persona: data.persona,
      });
      setForm({
        name: '',
        role: '',
        title: '',
        industry: '',
        goals: '',
        painPoints: '',
        desiredOutcome: '',
        valuePropToPersona: '',
        productId: '',
        companyHQId: defaultCompanyHQId,
      });
    } catch (err) {
      setError(err.message || 'Failed to create persona');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Create Persona
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Capture persona insights and align them with your product value
          proposition in real time.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Persona Name
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Solo Consultant"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <input
              name="role"
              value={form.role}
              onChange={handleChange}
              placeholder="Founder"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Principal Consultant"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Industry
            </label>
            <input
              name="industry"
              value={form.industry}
              onChange={handleChange}
              placeholder="Professional Services"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Goals
          </label>
          <textarea
            name="goals"
            value={form.goals}
            onChange={handleChange}
            placeholder="Grow their book of business without adding headcount."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Pain Points
          </label>
          <textarea
            name="painPoints"
            value={form.painPoints}
            onChange={handleChange}
            placeholder="Manual follow-up, inconsistent pipeline visibility, context-switching."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Desired Outcome
          </label>
          <textarea
            name="desiredOutcome"
            value={form.desiredOutcome}
            onChange={handleChange}
            placeholder="Automate client follow-up so nothing slips."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Value Prop to Persona
          </label>
          <textarea
            name="valuePropToPersona"
            value={form.valuePropToPersona}
            onChange={handleChange}
            placeholder="Simplify client management without hiring an assistant."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Product Alignment
            </label>
            <select
              name="productId"
              value={form.productId}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {loadingProducts && (
              <p className="text-xs text-gray-500">Loading products…</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              CompanyHQ ID
            </label>
            <input
              name="companyHQId"
              value={form.companyHQId}
              onChange={handleChange}
              placeholder="company-hq-id"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          {loading ? 'Saving…' : 'Create Persona'}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold">Persona created successfully.</p>
          {result.persona?.product?.name && (
            <p className="mt-1">
              <span className="font-medium text-blue-900">Aligned Product:</span>{' '}
              {result.persona.product.name}
            </p>
          )}
          <p className="mt-1 text-blue-900">
            <span className="font-medium">Alignment Score:</span>{' '}
            {result.alignmentScore ?? 'n/a'} / 100
          </p>
        </div>
      )}
    </div>
  );
}


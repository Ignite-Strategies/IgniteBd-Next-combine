'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Package, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

export default function ProductsPage() {
  // TODO WEDNESDAY FIX #2: Products must be tenant-scoped using companyHQId, not ownerId
  // All product queries must include companyHQId parameter
  const [products, setProducts] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [companyHQId, setCompanyHQId] = useState('');
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Load from localStorage only - no auto-fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    if (!storedCompanyHQId) {
      setError('Company context is required');
      return;
    }

    // Only load from localStorage
    const cachedProducts = window.localStorage.getItem('products');
    if (cachedProducts) {
      try {
        const parsed = JSON.parse(cachedProducts);
        if (Array.isArray(parsed)) {
          setProducts(parsed);
          setError(null);
        }
      } catch (error) {
        console.warn('Failed to parse cached products', error);
        setError('Failed to load products from cache');
      }
    }

    // Load personas from localStorage for display
    const cachedPersonas = window.localStorage.getItem('personas');
    if (cachedPersonas) {
      try {
        const parsed = JSON.parse(cachedPersonas);
        if (Array.isArray(parsed)) {
          setPersonas(parsed);
        }
      } catch (error) {
        console.warn('Failed to parse cached personas', error);
      }
    }
  }, []);

  // Manual sync function
  const handleSync = async () => {
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      // Fetch products
      const productsResponse = await api.get(`/api/products?companyHQId=${companyHQId}`);
      const productsData = Array.isArray(productsResponse.data) ? productsResponse.data : [];
      setProducts(productsData);
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('products', JSON.stringify(productsData));
      }

      // Also sync personas if needed (for display purposes)
      const cachedPersonas = window.localStorage.getItem('personas');
      if (!cachedPersonas) {
        try {
          const personasResponse = await api.get(`/api/personas?companyHQId=${companyHQId}`);
          const personasData = Array.isArray(personasResponse.data) ? personasResponse.data : [];
          setPersonas(personasData);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('personas', JSON.stringify(personasData));
          }
        } catch (err) {
          console.warn('Failed to fetch personas:', err);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to sync products:', err);
      setError('Failed to sync products. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              📦 Products & Services
            </h1>
            <p className="text-gray-600">
              Define your products and services to power BD Intelligence scoring.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing || !companyHQId}
              className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <Link
              href="/products/builder"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Product/Service
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {products.length === 0 ? (
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-12 text-center shadow-lg">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-blue-100 p-6">
                <Package className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              Create Your First Product/Service
            </h2>
            <p className="mb-2 text-lg text-gray-700">
              Products & Services power BD Intelligence scoring
            </p>
            <p className="mb-8 text-gray-600">
              Define your value propositions to match contacts with the right offers
            </p>
            <Link
              href="/products/builder"
              className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg"
            >
              Get Started →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {product.name || 'Product'}
                    </h3>
                  </div>
                  <Link
                    href={`/products/builder?productId=${product.id}`}
                    className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    Edit
                  </Link>
                </div>

                <div className="space-y-3 text-sm">
                  {product.valueProp && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Value Proposition:</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{product.valueProp}</p>
                    </div>
                  )}
                  {product.description && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Description:</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
                    </div>
                  )}
                  {(product.price || product.priceCurrency) && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Price:</p>
                      <p className="text-gray-600">
                        {product.priceCurrency || 'USD'} {product.price ? product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </p>
                    </div>
                  )}
                  {product.targetedTo && (
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Targeted To:</p>
                      <p className="text-gray-600">
                        {personas.find(p => p.id === product.targetedTo)?.name || `Persona ID: ${product.targetedTo}`}
                      </p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Created {new Date(product.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


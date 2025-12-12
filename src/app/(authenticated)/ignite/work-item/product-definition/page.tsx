import { Suspense } from 'react';
import ProductDefinitionClient from './ProductDefinitionClient';

export default function ProductDefinitionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-center">
              <p className="text-sm text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ProductDefinitionClient />
    </Suspense>
  );
}

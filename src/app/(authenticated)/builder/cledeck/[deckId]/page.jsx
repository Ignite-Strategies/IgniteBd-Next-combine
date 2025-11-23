'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Legacy CleDeck Builder - Redirects to Presentation Builder
 * This page exists to handle old CleDeck routes and redirect them to the new Presentation builder
 */
export default function CledeckBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.deckId;

  useEffect(() => {
    // Redirect all old cledeck routes to presentation builder
    if (deckId) {
      router.replace(`/builder/presentation/${deckId}`);
    } else {
      router.replace('/content/presentations');
    }
  }, [deckId, router]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-sm font-semibold text-gray-600">Redirecting to presentation builder...</p>
        </div>
      </div>
    </div>
  );
}

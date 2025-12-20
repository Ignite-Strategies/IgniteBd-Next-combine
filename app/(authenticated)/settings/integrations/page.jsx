'use client';

// Microsoft OAuth is now scoped to contacts ingest flow only
// This page redirects to /contacts/ingest/microsoft where OAuth has a specific purpose
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function IntegrationsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to contacts ingest where Microsoft OAuth has a specific purpose
    router.push('/contacts/ingest/microsoft');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Redirecting to contacts import...</p>
        </div>
      </div>
    </div>
  );
}

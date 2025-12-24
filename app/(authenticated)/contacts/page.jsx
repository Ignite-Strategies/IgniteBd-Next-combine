'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Contacts route redirects to People Hub
 * The People Hub at /people is the main hub for contact management
 * Contact-specific actions (upload, view, lists, etc.) are at /contacts/... routes
 */
export default function ContactsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to People Hub
    router.replace('/people');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to People Hub...</p>
      </div>
    </div>
  );
}


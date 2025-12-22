'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Manage page redirects to contacts view
 * Contact management (enrichment, editing, etc.) happens on individual contact detail pages
 * This follows the HubSpot pattern where you manage contacts via the contact detail page
 */
export default function ManagePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to contacts list where users can click on contacts to manage them
    router.replace('/contacts/view');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to contacts...</p>
      </div>
    </div>
  );
}


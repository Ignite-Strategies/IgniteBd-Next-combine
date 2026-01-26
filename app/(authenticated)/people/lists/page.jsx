'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';

// This page redirects to the list manager
export default function ListsPage() {
  const router = useRouter();
  
  // Redirect to list manager
  if (typeof window !== 'undefined') {
    router.replace('/contacts/list-manager');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
        <div className="text-gray-600">Redirecting to lists</div>
      </div>
    </div>
  );
}







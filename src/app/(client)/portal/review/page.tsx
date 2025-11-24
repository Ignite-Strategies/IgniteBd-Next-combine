'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import Link from 'next/link';

export default function PortalReviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const firebaseUser = getAuth().currentUser;
        if (!firebaseUser) {
          router.replace('/client-portal/login');
          return;
        }

        // Verify token is valid
        const token = await firebaseUser.getIdToken();
        if (!token) {
          router.replace('/client-portal/login');
          return;
        }

        setAuthenticated(true);
        setLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/client-portal/login');
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            BusinessPoint Law – Client Workspace
          </h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-6">
            CLE Presentation Draft
          </h2>
          
          <p className="text-gray-600 mb-8 text-lg">
            Below is your CLE deck outline for review.
          </p>

          <div className="mt-8">
            <Link
              href="/portal/review/cle"
              className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition shadow-md"
            >
              View CLE Outline
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


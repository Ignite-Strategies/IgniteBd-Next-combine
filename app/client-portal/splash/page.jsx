'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function ClientPortalSplashPage() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribe;
    const timer = setTimeout(() => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          // Redirect authenticated users directly to review page
          router.replace('/portal/review');
        } else {
          router.replace('/client-portal/login');
        }
      });
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
      <div className="text-center">
        <Image
          src="/logo.png"
          alt="Ignite Strategies"
          width={128}
          height={128}
          className="mx-auto mb-8 h-32 w-32 object-contain"
          priority
        />
        <h1 className="text-4xl font-bold text-white mb-2">
          Ignite Client Portal
        </h1>
        <p className="text-xl text-white/80 mb-4">
          by Ignite Strategies
        </p>
        <p className="text-lg text-white/60">
          Your engagement hub
        </p>
      </div>
    </div>
  );
}


'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Immediately check auth state and redirect - no splash screen
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/welcome');
      } else {
        router.replace('/signup');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Minimal render to avoid hydration issues
  return <div style={{ display: 'none' }} />;
}

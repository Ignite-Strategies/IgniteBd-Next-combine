'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribe;
    const timer = setTimeout(() => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          router.replace('/welcome');
        } else {
          router.replace('/signup');
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
          src="/favicon.png"
          alt="Ignite"
          width={128}
          height={128}
          className="mx-auto mb-8 h-32 w-32 object-contain"
          priority
        />
        <h1 className="text-4xl font-bold text-white mb-2">
          IgniteGrowth Engine
        </h1>
        <p className="text-xl text-white/80 mb-4">
          by Ignite Strategies
        </p>
        <p className="text-lg text-white/60">
          Fuel your business growth
        </p>
      </div>
    </div>
  );
}


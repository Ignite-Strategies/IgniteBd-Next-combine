'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function EventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';

  useEffect(() => {
    // Redirect to picker page
    if (companyHQId) {
      router.replace(`/events/picker?companyHQId=${companyHQId}`);
    } else {
      router.replace('/events/picker');
    }
  }, [companyHQId, router]);

  return null;
}

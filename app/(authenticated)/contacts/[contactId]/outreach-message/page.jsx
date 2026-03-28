'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import OutreachBuilder from '@/components/outreach/OutreachBuilder.jsx';

export default function OutreachMessagePage({ params }) {
  const { contactId } = use(params);
  const searchParams = useSearchParams();
  const companyHQId =
    searchParams?.get('companyHQId') ||
    (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : '') ||
    '';

  return <OutreachBuilder contactId={contactId} companyHQId={companyHQId} layout="page" />;
}

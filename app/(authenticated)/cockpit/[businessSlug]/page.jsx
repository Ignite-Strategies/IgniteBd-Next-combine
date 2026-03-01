'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import OwnerCockpitContainer from '@/components/outreach/OwnerCockpitContainer';
import api from '@/lib/api';

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'company';
}

function CockpitContent() {
  const params = useParams();
  const businessSlug = params?.businessSlug;
  const [companyHQId, setCompanyHQId] = useState(null);
  const [companyName, setCompanyName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessSlug) {
      setLoading(false);
      setError('Business slug is required');
      return;
    }

    // Get companyHQId from localStorage and verify slug matches
    const findCompanyBySlug = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get companyHQId from localStorage
        const storedCompanyId = typeof window !== 'undefined' 
          ? window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId')
          : null;

        if (!storedCompanyId) {
          setError('Company ID not found. Please ensure you are logged in.');
          setLoading(false);
          return;
        }

        // Fetch company and verify slug matches
        try {
          const companyRes = await api.get(`/api/company-hqs/${storedCompanyId}`);
          const company = companyRes.data?.company;
          
          if (!company) {
            setError('Company not found');
            setLoading(false);
            return;
          }

          const companySlug = slugify(company.companyName);
          if (companySlug !== businessSlug) {
            setError(`URL slug "${businessSlug}" does not match company "${company.companyName}" (expected: ${companySlug})`);
            setLoading(false);
            return;
          }

          setCompanyHQId(company.id);
          setCompanyName(company.companyName);
        } catch (err) {
          console.error('Error fetching company:', err);
          if (err?.response?.status === 404) {
            setError('Company not found');
          } else if (err?.response?.status === 403) {
            setError('Access denied to this company');
          } else {
            setError(err?.response?.data?.error || 'Failed to load company');
          }
        }
      } catch (err) {
        console.error('Error finding company:', err);
        setError(err?.response?.data?.error || 'Failed to load company');
      } finally {
        setLoading(false);
      }
    };

    findCompanyBySlug();
  }, [businessSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Owner Cockpit"
            subtitle="Loading..."
          />
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">Loading company...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !companyHQId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Owner Cockpit"
            subtitle="Company not found"
          />
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-base text-red-800">{error || 'Company not found'}</p>
            <p className="mt-2 text-sm text-gray-600">
              Please check the URL slug matches your company name.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Owner Cockpit"
          subtitle={companyName ? `Upcoming sends and engagements for ${companyName}` : 'Upcoming sends and engagements'}
          backTo="/outreach"
          backLabel="Back to Outreach"
        />
        <div className="mt-8">
          <OwnerCockpitContainer companyHQId={companyHQId} />
        </div>
      </div>
    </div>
  );
}

export default function CockpitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Owner Cockpit"
            subtitle="Loading..."
          />
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    }>
      <CockpitContent />
    </Suspense>
  );
}

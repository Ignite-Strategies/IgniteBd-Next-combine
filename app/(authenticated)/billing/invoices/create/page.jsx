'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import MilestoneBuilder from '@/components/billing/MilestoneBuilder';
import api from '@/lib/api';
import { Receipt, Loader2 } from 'lucide-react';

/**
 * Create Invoice Page
 * Allows users to create invoices with milestones for a WorkPackage
 */
function CreateInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillWorkPackageId = searchParams.get('workPackageId');

  const [workPackages, setWorkPackages] = useState([]);
  const [selectedWorkPackageId, setSelectedWorkPackageId] = useState(prefillWorkPackageId || '');
  const [selectedWorkPackage, setSelectedWorkPackage] = useState(null);
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load WorkPackages on mount - CHECK LOCALSTORAGE FIRST
  useEffect(() => {
    loadWorkPackages();
  }, []);

  // Load selected WorkPackage details and hydrate if needed
  useEffect(() => {
    if (selectedWorkPackageId) {
      loadWorkPackageDetailsAndHydrate(selectedWorkPackageId);
    } else {
      setSelectedWorkPackage(null);
    }
  }, [selectedWorkPackageId]);

  const loadWorkPackages = async () => {
    try {
      setLoading(true);
      
      // CHECK LOCALSTORAGE FIRST
      if (typeof window !== 'undefined') {
        const cached = window.localStorage.getItem('workPackages');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('✅ Loaded workpackages from localStorage:', parsed.length);
              setWorkPackages(parsed);
              setLoading(false);
              return; // Use cached data, skip API call
            }
          } catch (err) {
            console.warn('Failed to parse cached work packages', err);
          }
        }
      }

      // If no localStorage or empty, fetch from API
      const response = await api.get('/api/workpackages');
      if (response.data?.success) {
        const packages = response.data.workPackages || [];
        setWorkPackages(packages);
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('workPackages', JSON.stringify(packages));
        }
      }
    } catch (err) {
      console.error('Error loading work packages:', err);
      setError('Failed to load work packages');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkPackageDetailsAndHydrate = async (workPackageId) => {
    try {
      // Check localStorage first for this specific workPackage
      if (typeof window !== 'undefined') {
        const cached = window.localStorage.getItem('workPackages');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const found = parsed.find((wp) => wp.id === workPackageId);
            if (found) {
              setSelectedWorkPackage(found);
              
              // Get companyHQ from workPackage contact (contact.crmId is the companyHQId)
              const companyHQId = found.contact?.crmId;
              if (companyHQId) {
                await hydrateWorkPackagesByCompanyHQ(companyHQId);
              }
              return;
            }
          } catch (err) {
            console.warn('Failed to parse cached work packages', err);
          }
        }
      }

      // If not in cache, fetch from API
      const response = await api.get(`/api/workpackages?id=${workPackageId}`);
      if (response.data?.success) {
        const workPackage = response.data.workPackage;
        setSelectedWorkPackage(workPackage);
        
        // Get companyHQ from workPackage contact (contact.crmId is the companyHQId)
        const companyHQId = workPackage.contact?.crmId;
        if (companyHQId) {
          await hydrateWorkPackagesByCompanyHQ(companyHQId);
        }
      }
    } catch (err) {
      console.error('Error loading work package details:', err);
    }
  };

  const hydrateWorkPackagesByCompanyHQ = async (companyHQId) => {
    try {
      console.log('🔄 Hydrating workpackages for companyHQ:', companyHQId);
      
      // Fetch all workpackages for this companyHQ
      const response = await api.get(`/api/workpackages?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        const packages = response.data.workPackages || [];
        setWorkPackages(packages);
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('workPackages', JSON.stringify(packages));
          console.log('✅ Stored', packages.length, 'workpackages in localStorage');
        }
      }
    } catch (err) {
      console.error('Error hydrating workpackages by companyHQ:', err);
      // Don't set error - this is a background operation
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!selectedWorkPackageId) {
      setError('Please select a Work Package');
      return;
    }

    if (!invoiceName.trim()) {
      setError('Invoice Name is required');
      return;
    }

    if (milestones.length === 0) {
      setError('At least one milestone is required');
      return;
    }

    // Validate milestones
    const invalidMilestones = milestones.filter(
      (m) => !m.label?.trim() || !m.expectedAmount || m.expectedAmount <= 0
    );

    if (invalidMilestones.length > 0) {
      setError('All milestones must have a label and a positive expected amount');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare milestones data
      // Amounts are stored as integers (dollars), not cents
      const milestonesData = milestones.map((m) => ({
        label: m.label.trim(),
        expectedAmount: Math.round(parseFloat(m.expectedAmount)), // Store as integer dollars
        expectedDate: m.expectedDate || null,
        description: m.description?.trim() || null,
      }));

      const response = await api.post('/api/billing/invoices/create', {
        workPackageId: selectedWorkPackageId,
        invoiceName: invoiceName.trim(),
        invoiceDescription: invoiceDescription.trim() || null,
        milestones: milestonesData,
      });

      if (response.data?.success) {
        // Redirect to invoice detail page with success flag
        router.push(`/billing/invoices/${response.data.invoice.id}?created=true`);
      } else {
        setError(response.data?.error || 'Failed to create invoice');
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
      setError(
        err.response?.data?.error ||
        err.response?.data?.details ||
        'Failed to create invoice. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <span className="ml-3 text-gray-600">Loading work packages...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Invoice"
          subtitle="Create a new invoice with payment milestones"
          backTo="/billing"
          backLabel="Back to Billing"
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Work Package Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Package</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Work Package <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedWorkPackageId}
                onChange={(e) => setSelectedWorkPackageId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="">-- Select a Work Package --</option>
                {workPackages.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.title || 'Untitled'} - {wp.contact?.firstName} {wp.contact?.lastName}
                    {wp.contact?.contactCompany?.companyName
                      ? ` (${wp.contact.contactCompany.companyName})`
                      : ''}
                  </option>
                ))}
              </select>

              {selectedWorkPackage && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Contact:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedWorkPackage.contact?.firstName}{' '}
                        {selectedWorkPackage.contact?.lastName}
                      </span>
                    </div>
                    {selectedWorkPackage.company && (
                      <div>
                        <span className="text-gray-600">Company:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {selectedWorkPackage.company.companyName}
                        </span>
                      </div>
                    )}
                    {selectedWorkPackage.totalCost && (
                      <div>
                        <span className="text-gray-600">Total Cost:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          ${selectedWorkPackage.totalCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceName}
                  onChange={(e) => setInvoiceName(e.target.value)}
                  placeholder="e.g., Q1 2025 Invoice, Project Alpha Invoice"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Description
                </label>
                <textarea
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  placeholder="Optional description or notes about this invoice"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <MilestoneBuilder milestones={milestones} onChange={setMilestones} />
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedWorkPackageId || !invoiceName.trim() || milestones.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4" />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-red-600" />
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          </div>
        </div>
      }
    >
      <CreateInvoiceContent />
    </Suspense>
  );
}


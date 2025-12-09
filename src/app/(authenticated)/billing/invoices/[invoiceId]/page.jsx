'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import { Receipt, Loader2, CheckCircle2, Calendar, DollarSign, User, Building2 } from 'lucide-react';
import Link from 'next/link';

/**
 * Invoice Detail Page
 * Displays invoice details and milestones (draft view - no payment processing)
 */
function InvoiceDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params.invoiceId as string;
  const showSuccess = searchParams.get('created') === 'true';

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        router.replace(`/billing/invoices/${invoiceId}`, { scroll: false });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, invoiceId, router]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/billing/invoices/${invoiceId}`);
      if (response.data?.success) {
        setInvoice(response.data.invoice);
      } else {
        setError(response.data?.error || 'Failed to load invoice');
      }
    } catch (err) {
      console.error('Error loading invoice:', err);
      setError(err.response?.data?.error || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    // Amount is stored as integer dollars
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      partially_paid: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-semibold ${
          colors[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <span className="ml-3 text-gray-600">Loading invoice...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Invoice Not Found"
            subtitle={error}
            backTo="/billing"
            backLabel="Back to Billing"
          />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  const workPackage = invoice.workPackage;
  const contact = workPackage?.contact;
  const company = workPackage?.company;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Invoice Details"
          subtitle={invoice.invoiceName}
          backTo="/billing"
          backLabel="Back to Billing"
        />

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Invoice created successfully!
            </span>
          </div>
        )}

        {/* Invoice Header Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {invoice.invoiceName}
              </h2>
              {invoice.invoiceDescription && (
                <p className="text-gray-600">{invoice.invoiceDescription}</p>
              )}
            </div>
            <div className="text-right">
              {getStatusBadge(invoice.status)}
              <p className="text-xs text-gray-500 mt-2">Invoice ID: {invoice.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <DollarSign className="h-4 w-4" />
                <span>Total Expected</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(invoice.totalExpected)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <DollarSign className="h-4 w-4" />
                <span>Total Received</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(invoice.totalReceived)}
              </p>
            </div>
          </div>
        </div>

        {/* Work Package & Contact Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Work Package & Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workPackage && (
              <div>
                <Link
                  href={`/workpackages/${workPackage.id}`}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  {workPackage.title || 'Untitled Work Package'}
                </Link>
              </div>
            )}
            {contact && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">
                  {contact.firstName} {contact.lastName}
                </span>
                {contact.email && (
                  <span className="text-gray-500 text-sm">({contact.email})</span>
                )}
              </div>
            )}
            {company && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">{company.companyName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Milestones</h3>
          {invoice.milestones && invoice.milestones.length > 0 ? (
            <div className="space-y-4">
              {invoice.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {milestone.label}
                      </h4>
                      {milestone.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {milestone.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {formatCurrency(milestone.expectedAmount)}
                          </span>
                        </div>
                        {milestone.expectedDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {formatDate(milestone.expectedDate)}
                            </span>
                          </div>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            milestone.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {milestone.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No milestones found</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-red-600" />
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          </div>
        </div>
      }
    >
      <InvoiceDetailContent />
    </Suspense>
  );
}

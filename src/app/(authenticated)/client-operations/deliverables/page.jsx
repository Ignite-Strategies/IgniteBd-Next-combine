'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ContactSelector from '@/components/ContactSelector';
import { FileText, CheckCircle, Clock, AlertCircle, RefreshCw, FileCheck, Plus, User, Building2 } from 'lucide-react';
import api from '@/lib/api';

export default function DeliverablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedId);

    // Load from localStorage first
    const cached = window.localStorage.getItem('deliverables');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setDeliverables(parsed);
        }
      } catch (error) {
        console.warn('Failed to parse cached deliverables', error);
      }
    }
    setLoading(false);
  }, []);

  // Fetch deliverables when contact changes
  useEffect(() => {
    if (selectedContact?.id) {
      fetchDeliverables(selectedContact.id);
    } else {
      // If no contact selected, fetch all deliverables for companyHQId
      fetchDeliverables();
    }
  }, [selectedContact, companyHQId]);

  const fetchDeliverables = async (contactId = null) => {
    if (!companyHQId) return;
    
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (contactId) {
        params.append('contactId', contactId);
      }
      
      // Fetch deliverables - API will filter by contactId if provided
      const response = await api.get(`/api/deliverables?${params.toString()}`);
      if (response.data?.success && response.data.deliverables) {
        const fetched = response.data.deliverables;
        setDeliverables(fetched);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('deliverables', JSON.stringify(fetched));
        }
      }
    } catch (err) {
      console.error('Error fetching deliverables:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedContact?.id) {
      fetchDeliverables(selectedContact.id);
    } else {
      fetchDeliverables();
    }
  };

  const handleContactChange = (contact) => {
    setSelectedContact(contact);
    // Fetch deliverables for this contact
    if (contact?.id) {
      fetchDeliverables(contact.id);
    } else {
      fetchDeliverables();
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Client Delivery"
          subtitle="Build and manage deliverables for your clients"
          backTo="/client-operations"
          backLabel="Back to Client Operations"
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow transition hover:bg-gray-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push('/client-operations/proposals')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <FileCheck className="h-4 w-4" />
                View Proposals
              </button>
            </div>
          }
        />

        {/* Contact Selector */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <ContactSelector
            contactId={selectedContact?.id}
            onContactChange={handleContactChange}
            showLabel={true}
          />
          
          {/* Contact Banner */}
          {selectedContact && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Working for: {selectedContact.firstName} {selectedContact.lastName}
                  </div>
                  {selectedContact.contactCompany?.companyName && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <Building2 className="h-3 w-3" />
                      {selectedContact.contactCompany.companyName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Build Actions */}
        {selectedContact && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => router.push(`/client-operations/deliverables/client-persona-build?contactId=${selectedContact.id}`)}
              className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
            >
              <div className="mb-2 text-sm font-semibold text-gray-900">Build Persona</div>
              <div className="text-xs text-gray-500">Create a target persona for this contact</div>
            </button>
            <button
              type="button"
              onClick={() => router.push(`/client-operations/deliverables/client-blog-build?contactId=${selectedContact.id}`)}
              className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
            >
              <div className="mb-2 text-sm font-semibold text-gray-900">Build Blog</div>
              <div className="text-xs text-gray-500">Create blog content for this contact</div>
            </button>
            <button
              type="button"
              onClick={() => router.push(`/client-operations/deliverables/client-upload?contactId=${selectedContact.id}`)}
              className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
            >
              <div className="mb-2 text-sm font-semibold text-gray-900">Upload Work</div>
              <div className="text-xs text-gray-500">Upload or paste work content</div>
            </button>
          </div>
        )}

        {/* Deliverables List */}
        <div className="mt-8">
          {!selectedContact ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Select a Contact
              </h3>
              <p className="text-gray-600 mb-6">
                Select a contact above to view and manage their deliverables.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading deliverables...</p>
            </div>
          ) : deliverables.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Deliverables Yet
              </h3>
              <p className="text-gray-600 mb-6">
                No deliverables found for {selectedContact.firstName} {selectedContact.lastName}. Start building work artifacts above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {deliverables.map((deliverable) => (
                <div
                  key={deliverable.id}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(deliverable.status)}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {deliverable.title}
                        </h3>
                        <span className="rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700">
                          {deliverable.status}
                        </span>
                      </div>
                      {deliverable.description && (
                        <p className="text-gray-600 mb-2">{deliverable.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {deliverable.contact && (
                          <span>
                            Contact: {deliverable.contact.firstName} {deliverable.contact.lastName}
                          </span>
                        )}
                        {deliverable.proposal && (
                          <span>
                            Proposal: {deliverable.proposal.clientName}
                          </span>
                        )}
                        {deliverable.dueDate && (
                          <span>
                            Due: {new Date(deliverable.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


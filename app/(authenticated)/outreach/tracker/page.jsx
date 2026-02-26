'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import api from '@/lib/api';

function OutreachTrackerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams.get('companyHQId') || (typeof window !== 'undefined' && (window.localStorage?.getItem('companyHQId') || window.localStorage?.getItem('companyId'))) || '';

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(() => ({
    sendDateFrom: searchParams.get('sendDateFrom') || '',
    sendDateTo: searchParams.get('sendDateTo') || '',
    followUpDateFrom: searchParams.get('followUpDateFrom') || '',
    followUpDateTo: searchParams.get('followUpDateTo') || '',
    hasResponded: searchParams.get('hasResponded') || '',
  }));
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    totalCount: 0,
    hasMore: false,
  });

  const fetchContacts = async () => {
    if (!companyHQId) {
      setError('Company ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        companyHQId,
        limit: pagination.limit,
        offset: pagination.offset,
      };
      if (filters.sendDateFrom) params.sendDateFrom = filters.sendDateFrom;
      if (filters.sendDateTo) params.sendDateTo = filters.sendDateTo;
      if (filters.followUpDateFrom) params.followUpDateFrom = filters.followUpDateFrom;
      if (filters.followUpDateTo) params.followUpDateTo = filters.followUpDateTo;
      if (filters.hasResponded) params.hasResponded = filters.hasResponded;

      const response = await api.get('/api/outreach/tracker', { params });
      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch contacts');
      }

      setContacts(data.contacts || []);
      setPagination(prev => ({
        ...prev,
        totalCount: data.totalCount || 0,
        hasMore: data.pagination?.hasMore || false,
      }));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to fetch contacts';
      setError(message);
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [companyHQId, filters, pagination.offset]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  const handlePrevPage = () => {
    setPagination(prev => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntilDue = (nextSendDate) => {
    if (!nextSendDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(nextSendDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (contact) => {
    const daysUntilDue = getDaysUntilDue(contact.nextSendDate);
    
    // Check if any email has been responded to
    const hasAnyResponse = contact.emails?.some(e => e.hasResponded);
    
    if (hasAnyResponse) {
      return <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Responded</span>;
    }
    
    if (daysUntilDue === null) {
      return <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">No follow-up</span>;
    }
    
    if (daysUntilDue < 0) {
      return <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Overdue ({Math.abs(daysUntilDue)}d)</span>;
    }
    
    if (daysUntilDue === 0) {
      return <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Due today</span>;
    }
    
    return <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">Due in {daysUntilDue}d</span>;
  };

  // Group contacts by next follow-up date for chronological-by-date view
  const contactsByDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const formatDateLabel = (isoDate) => {
      if (!isoDate) return null;
      const d = new Date(isoDate);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
    };
    const groups = {};
    const noDate = [];
    for (const c of contacts) {
      const dateKey = c.nextSendDate ? new Date(c.nextSendDate).toISOString().slice(0, 10) : null;
      if (!dateKey) {
        noDate.push(c);
        continue;
      }
      if (!groups[dateKey]) groups[dateKey] = { label: formatDateLabel(c.nextSendDate), contacts: [] };
      groups[dateKey].contacts.push(c);
    }
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    if (noDate.length) sorted.push([null, { label: 'No follow-up date', contacts: noDate }]);
    return sorted;
  }, [contacts]);

  if (!companyHQId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Outreach Tracker</h1>
        <p className="text-gray-600">Company ID is required. Please provide companyHQId in the URL.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Outreach Tracker</h1>
          <p className="text-gray-600">Track all contacts with email sends — chronological by follow-up date</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/outreach')}
          className="text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          ← Back to Outreach Dashboard
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send Date From
            </label>
            <input
              type="date"
              value={filters.sendDateFrom}
              onChange={(e) => handleFilterChange('sendDateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send Date To
            </label>
            <input
              type="date"
              value={filters.sendDateTo}
              onChange={(e) => handleFilterChange('sendDateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Follow-Up Date From
            </label>
            <input
              type="date"
              value={filters.followUpDateFrom}
              onChange={(e) => handleFilterChange('followUpDateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Follow-Up Date To
            </label>
            <input
              type="date"
              value={filters.followUpDateTo}
              onChange={(e) => handleFilterChange('followUpDateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Has Responded
            </label>
            <select
              value={filters.hasResponded}
              onChange={(e) => handleFilterChange('hasResponded', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                sendDateFrom: '',
                sendDateTo: '',
                followUpDateFrom: '',
                followUpDateTo: '',
                hasResponded: '',
              })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading contacts...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {contacts.length} of {pagination.totalCount} contacts
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!pagination.hasMore}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {contacts.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No contacts found matching your filters.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {contactsByDate.map(([dateKey, { label, contacts: groupContacts }]) => (
                  <div key={dateKey ?? 'none'} className="overflow-hidden">
                    <div className="flex items-center gap-2 bg-gray-50 px-6 py-3 text-sm font-semibold text-gray-700">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      {label}
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/60">
                        <tr>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Send</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Follow-Up</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emails</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {groupContacts.map((contact) => (
                          <tr key={contact.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => router.push(`/contacts/${contact.id}`)}
                                className="text-left"
                              >
                                <div className="text-sm font-medium text-gray-900 hover:text-amber-600">
                                  {contact.firstName} {contact.lastName}
                                </div>
                                <div className="text-sm text-gray-500">{contact.email}</div>
                              </button>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(contact.lastSendDate)}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(contact.nextSendDate)}
                              {contact.remindMeOn && (
                                <span className="ml-2 text-xs text-blue-600">(Manual)</span>
                              )}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                              {contact.emailCount} email{contact.emailCount !== 1 ? 's' : ''}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              {getStatusBadge(contact)}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => router.push(`/contacts/${contact.id}`)}
                                className="text-xs font-medium text-amber-600 hover:text-amber-700"
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function OutreachTrackerPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <OutreachTrackerContent />
    </Suspense>
  );
}

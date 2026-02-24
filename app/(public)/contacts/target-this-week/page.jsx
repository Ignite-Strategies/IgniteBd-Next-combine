'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, User, Loader2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

export default function ContactsToTargetThisWeekPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const targetListId = searchParams?.get('targetListId') || '';
  
  const [contactsByDate, setContactsByDate] = useState({});
  const [sortedDates, setSortedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyHQId) {
      setError('companyHQId is required');
      setLoading(false);
      return;
    }

    const fetchContacts = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Use target list endpoint if targetListId is provided, otherwise use default endpoint
        const url = targetListId
          ? `/api/public/target-lists/${targetListId}?companyHQId=${companyHQId}`
          : `/api/public/contacts/target-this-week?companyHQId=${companyHQId}`;
        
        const response = await api.get(url);
        
        if (response.data?.success) {
          setContactsByDate(response.data.contactsByDate || {});
          setSortedDates(response.data.sortedDates || []);
        } else {
          setError(response.data?.error || 'Failed to load contacts');
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
        setError(err.response?.data?.error || 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [companyHQId, targetListId]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    const isToday = dateOnly.getTime() === today.getTime();
    const isTomorrow = dateOnly.getTime() === today.getTime() + 86400000;
    
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <div className="mt-4 text-gray-600">Loading contacts...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  const totalContacts = Object.values(contactsByDate).reduce((sum, contacts) => sum + contacts.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Contacts to Target This Week</h1>
          <p className="mt-2 text-sm text-gray-600">
            {totalContacts} contact{totalContacts !== 1 ? 's' : ''} scheduled for outreach
          </p>
        </div>

        {sortedDates.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600">No contacts scheduled for this week.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date) => {
              const contacts = contactsByDate[date];
              return (
                <div
                  key={date}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <h2 className="text-lg font-semibold text-gray-900">
                        {formatDate(date)}
                      </h2>
                      <span className="ml-auto rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (companyHQId) params.set('companyHQId', companyHQId);
                          if (targetListId) params.set('targetListId', targetListId);
                          const queryString = params.toString();
                          const url = `/contacts/public/${contact.id}${queryString ? `?${queryString}` : ''}`;
                          router.push(url);
                        }}
                        className="w-full px-6 py-4 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{contact.name}</div>
                              {contact.email && (
                                <div className="text-sm text-gray-500">{contact.email}</div>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, ChevronRight, Download, Upload, Copy, X, CheckCircle, AlertCircle, Target, FileText, Edit } from 'lucide-react';
import api from '@/lib/api';
import { getTodayEST, formatDateLabelEST, addDaysEST, formatDateEST } from '@/lib/dateEst';

/**
 * Owner Cockpit Container
 * - Welcome message with company name
 * - Week of date selector
 * - Upcoming sends (next engagements) for selected week
 * - Next target lists placeholder
 * - Update contact notes placeholder
 * - Bulk import/update next engagements via copy/paste or file upload
 */
export default function OwnerCockpitContainer({
  companyHQId,
  companyName,
  limit = 500,
}) {
  const router = useRouter();
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    // Default to start of current week (Monday)
    const today = getTodayEST();
    const date = new Date(today + 'T12:00:00Z');
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(date.setUTCDate(diff));
    return monday.toISOString().slice(0, 10);
  });
  const [nextEngagements, setNextEngagements] = useState([]);
  const [filteredEngagements, setFilteredEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedCompanyId, setResolvedCompanyId] = useState(companyHQId || null);
  
  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const fileInputRef = useRef(null);

  const todayEST = getTodayEST();
  const weekEnd = addDaysEST(selectedWeekStart, 6);

  useEffect(() => {
    const id = companyHQId || (typeof window !== 'undefined' && (window.localStorage?.getItem('companyHQId') || window.localStorage?.getItem('companyId')));
    setResolvedCompanyId(id || null);
  }, [companyHQId]);

  useEffect(() => {
    if (!resolvedCompanyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get(`/api/outreach/next-engagements`, {
      params: { companyHQId: resolvedCompanyId, limit },
    })
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setNextEngagements(res.data.nextEngagements || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || 'Failed to load next engagements');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [resolvedCompanyId, limit]);

  // Filter engagements for selected week
  useEffect(() => {
    const filtered = nextEngagements.filter((e) => {
      if (!e.nextEngagementDate) return false;
      return e.nextEngagementDate >= selectedWeekStart && e.nextEngagementDate <= weekEnd;
    });
    setFilteredEngagements(filtered);
  }, [nextEngagements, selectedWeekStart, weekEnd]);

  const groupByDate = (list) => {
    const groups = {};
    for (const r of list) {
      const key = r.nextEngagementDate || '';
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const sectionTitle = (estDateKey) => {
    const { label, actual } = formatDateLabelEST(todayEST, estDateKey);
    if (label === 'Today') return 'Due today';
    if (label === 'Tomorrow') return 'Due tomorrow';
    if (label === 'Yesterday') return 'Yesterday';
    return actual || estDateKey;
  };

  const name = (r) => [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.goesBy || r.email || '—';

  const purposeLabel = (purpose) => {
    if (!purpose) return 'Follow-up';
    const labels = {
      GENERAL_CHECK_IN: 'General check-in',
      UNRESPONSIVE: 'Unresponsive',
      PERIODIC_CHECK_IN: 'Periodic check-in',
      REFERRAL_NO_CONTACT: 'Referral (no contact)',
    };
    return labels[purpose] || purpose;
  };

  const handleExport = () => {
    if (filteredEngagements.length === 0) return;
    const headers = ['Name', 'Email', 'Date', 'Purpose', 'Note'];
    const rows = filteredEngagements.map((r) => [
      name(r),
      r.email || '',
      r.nextEngagementDate || '',
      purposeLabel(r.nextEngagementPurpose),
      (r.nextContactNote || '').replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c)}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `next-engagements-week-${selectedWeekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseBulkInput = (text) => {
    const lines = text.trim().split('\n').filter((line) => line.trim());
    const results = [];
    
    for (const line of lines) {
      // Try CSV format: email,date,purpose,note
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 2) {
        const [email, date, purpose, ...noteParts] = parts;
        if (email && date) {
          results.push({
            email: email.toLowerCase(),
            date: date.slice(0, 10), // Ensure YYYY-MM-DD
            purpose: purpose || null,
            note: noteParts.join(',').trim() || null,
          });
        }
      } else {
        // Try tab-separated or space-separated
        const tabParts = line.split('\t');
        if (tabParts.length >= 2) {
          const [email, date, purpose, ...noteParts] = tabParts.map((p) => p.trim());
          if (email && date) {
            results.push({
              email: email.toLowerCase(),
              date: date.slice(0, 10),
              purpose: purpose || null,
              note: noteParts.join('\t').trim() || null,
            });
          }
        }
      }
    }
    
    return results;
  };

  const handleFileUpload = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parsed = parseBulkInput(text);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleBulkImport = async () => {
    if (!resolvedCompanyId) {
      setError('Company ID not found');
      return;
    }

    setBulkProcessing(true);
    setBulkResults(null);
    setError(null);

    try {
      let parsedData = [];
      
      if (bulkFile) {
        parsedData = await handleFileUpload(bulkFile);
      } else if (bulkInput.trim()) {
        parsedData = parseBulkInput(bulkInput);
      } else {
        setError('Please provide data via copy/paste or file upload');
        setBulkProcessing(false);
        return;
      }

      if (parsedData.length === 0) {
        setError('No valid data found. Expected format: email,date,purpose,note');
        setBulkProcessing(false);
        return;
      }

      // Fetch all contacts to match by email
      const contactsRes = await api.get(`/api/outreach/next-engagements`, {
        params: { companyHQId: resolvedCompanyId, limit: 1000 },
      });
      
      const allContacts = contactsRes.data?.nextEngagements || [];
      const emailToContact = {};
      allContacts.forEach((c) => {
        if (c.email) {
          emailToContact[c.email.toLowerCase()] = c;
        }
      });

      // Process updates
      const results = {
        success: 0,
        failed: 0,
        notFound: 0,
        errors: [],
      };

      for (const item of parsedData) {
        const contact = emailToContact[item.email];
        if (!contact) {
          results.notFound++;
          results.errors.push(`Contact not found: ${item.email}`);
          continue;
        }

        try {
          const updateData = {
            nextEngagementDate: item.date || null,
            nextEngagementPurpose: item.purpose || null,
          };

          await api.patch(`/api/contacts/${contact.contactId}/next-engagement`, updateData);
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push(`${item.email}: ${err?.response?.data?.error || err.message}`);
        }
      }

      setBulkResults(results);
      
      // Refresh engagements
      const refreshRes = await api.get(`/api/outreach/next-engagements`, {
        params: { companyHQId: resolvedCompanyId, limit },
      });
      if (refreshRes.data?.success) {
        setNextEngagements(refreshRes.data.nextEngagements || []);
      }

      // Clear inputs
      setBulkInput('');
      setBulkFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Bulk import failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleWeekChange = (direction) => {
    const newStart = addDaysEST(selectedWeekStart, direction * 7);
    setSelectedWeekStart(newStart);
  };

  const formatWeekLabel = () => {
    const start = formatDateEST(selectedWeekStart, { month: 'short', day: 'numeric' });
    const end = formatDateEST(weekEnd, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  const formatMondayDate = () => {
    return formatDateEST(selectedWeekStart, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (!resolvedCompanyId) return null;

  const grouped = groupByDate(filteredEngagements);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome {companyName || 'to Owner Cockpit'}
        </h1>
        <p className="text-base text-gray-700">
          Here is the outlook for week of {formatMondayDate()}
        </p>
      </div>

      {/* Main Container */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Reach Outs</h3>
            </div>
            <p className="mt-1 text-sm font-medium text-amber-700/90">Next engagements for selected week</p>
          </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredEngagements.length === 0}
            className="flex items-center gap-2 text-base font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download as CSV"
          >
            <Download className="h-5 w-5" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </button>
        </div>
      </div>

      {/* Week Selector */}
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Week of:</span>
            <input
              type="date"
              value={selectedWeekStart}
              onChange={(e) => setSelectedWeekStart(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-sm text-gray-600">{formatWeekLabel()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleWeekChange(-1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => {
                const today = getTodayEST();
                const date = new Date(today + 'T12:00:00Z');
                const day = date.getUTCDay();
                const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(date.setUTCDate(diff));
                setSelectedWeekStart(monday.toISOString().slice(0, 10));
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handleWeekChange(1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Import Panel */}
      {showBulkImport && (
        <div className="border-b border-gray-200 bg-blue-50/50 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-base font-semibold text-gray-900">Bulk Import Next Engagements</h4>
            <button
              type="button"
              onClick={() => {
                setShowBulkImport(false);
                setBulkInput('');
                setBulkFile(null);
                setBulkResults(null);
                setError(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-3 text-sm text-gray-600">
            Format: <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">email,date(YYYY-MM-DD),purpose,note</code>
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Copy & Paste (CSV format)</label>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="email@example.com,2026-03-05,GENERAL_CHECK_IN,Follow up note"
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Or Upload File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-blue-700"
              />
            </div>
            {bulkResults && (
              <div className={`rounded-lg border p-3 ${bulkResults.failed > 0 || bulkResults.notFound > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
                <div className="flex items-start gap-2">
                  {bulkResults.failed === 0 && bulkResults.notFound === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  )}
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-gray-900">
                      Processed: {bulkResults.success} successful, {bulkResults.failed} failed, {bulkResults.notFound} not found
                    </p>
                    {bulkResults.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-900">Show errors</summary>
                        <ul className="mt-1 ml-4 list-disc space-y-1 text-xs text-gray-600">
                          {bulkResults.errors.slice(0, 10).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {bulkResults.errors.length > 10 && (
                            <li>... and {bulkResults.errors.length - 10} more</li>
                          )}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={bulkProcessing || (!bulkInput.trim() && !bulkFile)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkProcessing ? 'Processing...' : 'Import'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkInput('');
                  setBulkFile(null);
                  setBulkResults(null);
                  setError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engagements List */}
      {loading ? (
        <div className="p-8">
          <div className="flex items-center gap-3 text-gray-500">
            <Mail className="h-6 w-6" />
            <span className="text-base">Loading next engagements…</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-base text-red-800">{error}</p>
          </div>
        </div>
      ) : grouped.length === 0 ? (
        <div className="p-8 text-center text-base text-gray-500">
          No next engagements for this week.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {grouped.map(([dateKey, items]) => (
            <li key={dateKey}>
              <div className="bg-amber-50/80 border-l-2 border-amber-400 px-5 py-3 text-sm font-semibold text-gray-700">
                <Calendar className="mr-2 inline h-4 w-4 text-amber-600" />
                <span className="text-amber-800">{sectionTitle(dateKey)}</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {items.map((r) => (
                  <li key={r.contactId}>
                    <button
                      type="button"
                      onClick={() => router.push(`/contacts/${r.contactId}`)}
                      className="flex w-full items-center justify-between text-left px-5 py-4 hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium text-gray-900">{name(r)}</p>
                        <p className="truncate text-sm text-gray-500">
                          {purposeLabel(r.nextEngagementPurpose)}
                          {r.nextContactNote && ` · ${r.nextContactNote}`}
                        </p>
                      </div>
                      <ChevronRight className="shrink-0 h-5 w-5 text-gray-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      </div>

      {/* Next Target Lists Section */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Target className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Next Target Lists</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Target lists functionality coming soon. This will help you organize and prioritize your outreach efforts.
          </p>
        </div>
      </div>

      {/* Update Contact Notes Section */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Update Contact Notes</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md">
            Need to update notes on a contact? Do it here.
          </p>
          <button
            type="button"
            onClick={() => {
              // TODO: Implement contact notes update UI
              alert('Contact notes update functionality coming soon!');
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Edit className="h-4 w-4" />
            Update Contact Notes
          </button>
        </div>
      </div>
    </div>
  );
}

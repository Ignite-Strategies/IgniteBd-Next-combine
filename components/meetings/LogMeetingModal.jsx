'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, User, Loader2, Check, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { PIPELINE_STAGES } from '@/lib/config/pipelineConfig';

const MEETING_TYPES = [
  { value: 'INTRO', label: 'Intro' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'PROPOSAL_REVIEW', label: 'Proposal review' },
  { value: 'CHECK_IN', label: 'Check-in' },
  { value: 'OTHER', label: 'Other' },
];

const OUTCOMES = [
  { value: 'POSITIVE', label: 'Positive', short: '+', color: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200' },
  { value: 'NEUTRAL', label: 'Neutral', short: '~', color: 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200' },
  { value: 'NEGATIVE', label: 'Negative', short: '−', color: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200' },
  { value: 'NO_SHOW', label: 'No show', short: 'N/S', color: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' },
];

export default function LogMeetingModal({ isOpen, onClose, companyHQId, preSelectedContact, onSaved }) {
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meetingType, setMeetingType] = useState('FOLLOW_UP');
  const [outcome, setOutcome] = useState(null);
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextEngagementDate, setNextEngagementDate] = useState('');
  const [pipeline, setPipeline] = useState('prospect');
  const [stage, setStage] = useState('meeting');
  const [blobText, setBlobText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedFromBlob, setParsedFromBlob] = useState(false);

  useEffect(() => {
    if (preSelectedContact) {
      setSelectedContact(preSelectedContact);
      setContactSearch(preSelectedContact.fullName || [preSelectedContact.firstName, preSelectedContact.lastName].filter(Boolean).join(' ') || preSelectedContact.email || '');
      const pipe = preSelectedContact.pipelines || preSelectedContact.pipelineSnap ? { pipeline: preSelectedContact.pipelineSnap || 'prospect', stage: preSelectedContact.pipelineStageSnap || 'interest' } : null;
      if (pipe?.pipeline) setPipeline(pipe.pipeline);
      if (pipe?.stage) setStage(pipe.stage);
    }
  }, [preSelectedContact]);

  useEffect(() => {
    if (!isOpen || !companyHQId) return;
    setLoadingContacts(true);
    api.get(`/api/contacts?companyHQId=${companyHQId}`)
      .then((res) => {
        if (res.data?.success && res.data?.contacts) {
          setContacts(res.data.contacts);
        }
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load contacts'))
      .finally(() => setLoadingContacts(false));
  }, [isOpen, companyHQId]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 50);
    const q = contactSearch.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);
    return contacts
      .filter((c) => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ').toLowerCase();
        const full = (c.fullName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const company = (c.companyName || '').toLowerCase();
        return terms.every((t) =>
          name.includes(t) || full.includes(t) || email.includes(t) || company.includes(t)
        );
      })
      .slice(0, 20);
  }, [contacts, contactSearch]);

  const prospectStages = PIPELINE_STAGES.prospect || [];
  const currentPipelineStages = PIPELINE_STAGES[pipeline] || prospectStages;

  const handleParseBlob = async () => {
    if (!blobText.trim()) return;
    setParsing(true);
    setError('');
    try {
      const res = await api.post('/api/meetings/parse-blob', { blob: blobText });
      if (res.data?.success && res.data?.parsed) {
        const p = res.data.parsed;
        const searchParts = [p.contactName, p.companyName].filter(Boolean);
        if (searchParts.length) setContactSearch(searchParts.join(' '));
        if (p.rawNotes) setNotes(p.rawNotes);
        if (p.suggestedMeetingType) setMeetingType(p.suggestedMeetingType);
        setParsedFromBlob(true);
      } else {
        setError(res.data?.error || 'Parse failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to parse');
    } finally {
      setParsing(false);
    }
  };

  const handleSelectContact = (c) => {
    setSelectedContact(c);
    setContactSearch(c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || '');
    const pipe = c.pipelines ? { pipeline: c.pipelines.pipeline, stage: c.pipelines.stage } : { pipeline: c.pipelineSnap || 'prospect', stage: c.pipelineStageSnap || 'interest' };
    setPipeline(pipe.pipeline || 'prospect');
    setStage(pipe.stage || 'interest');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedContact) {
      setError('Please select a contact');
      return;
    }
    if (!companyHQId) {
      setError('Company context is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/api/meetings', {
        contactId: selectedContact.id,
        companyHQId,
        meetingDate,
        meetingType,
        outcome: outcome || undefined,
        notes: notes.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        nextEngagementDate: nextEngagementDate.trim() || undefined,
        pipeline: pipeline || undefined,
        stage: stage || undefined,
      });
      if (res.data?.success) {
        onSaved?.(res.data.meeting);
        onClose();
      } else {
        setError(res.data?.error || 'Failed to save meeting');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save meeting');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedContact(preSelectedContact || null);
    setContactSearch(preSelectedContact ? (preSelectedContact.fullName || [preSelectedContact.firstName, preSelectedContact.lastName].filter(Boolean).join(' ') || preSelectedContact.email || '') : '');
    setMeetingDate(new Date().toISOString().slice(0, 10));
    setMeetingType('FOLLOW_UP');
    setOutcome(null);
    setNotes('');
    setNextAction('');
    setNextEngagementDate('');
    setPipeline('prospect');
    setStage('meeting');
    setBlobText('');
    setParsedFromBlob(false);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Log Meeting
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Blob parse */}
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Sparkles className="inline h-4 w-4 mr-1 text-amber-500" />
                Paste meeting note (from you or VA)
              </label>
              <textarea
                value={blobText}
                onChange={(e) => setBlobText(e.target.value)}
                placeholder='e.g. "Joel has an upcoming meeting with Sarah, a former client. She reached out via the website and is from Acme Corp."'
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-2"
              />
              <button
                type="button"
                onClick={handleParseBlob}
                disabled={parsing || !blobText.trim()}
                className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Parse & pre-fill
              </button>
              {parsedFromBlob && (
                <p className="mt-2 text-xs text-green-600">Parsed. Review and select contact below.</p>
              )}
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <div className="relative">
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    if (!e.target.value) setSelectedContact(null);
                  }}
                  placeholder="Search by name or email..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                {contactSearch && filteredContacts.length > 0 && !selectedContact && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectContact(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col"
                      >
                        <span className="font-medium text-gray-900">{c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'No name'}</span>
                        {c.email && <span className="text-xs text-gray-500">{c.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {selectedContact && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    {selectedContact.fullName || [selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(' ')}
                    <button type="button" onClick={() => { setSelectedContact(null); setContactSearch(''); }} className="text-gray-400 hover:text-gray-600 text-xs">Clear</button>
                  </div>
                )}
              </div>
            </div>

            {/* Date & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {MEETING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Outcome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">How did it go?</label>
              <div className="flex gap-2 flex-wrap">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(outcome === o.value ? null : o.value)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${outcome === o.value ? o.color : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    {o.short} {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="What happened? Key takeaways..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Next action & Follow-up date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next action</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Send proposal"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up date</label>
                <input
                  type="date"
                  value={nextEngagementDate}
                  onChange={(e) => setNextEngagementDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Pipeline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline stage</label>
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  value={pipeline}
                  onChange={(e) => {
                    setPipeline(e.target.value);
                    const stages = PIPELINE_STAGES[e.target.value] || [];
                    setStage(stages[0] || '');
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="prospect">Prospect</option>
                  <option value="connector">Connector</option>
                  <option value="client">Client</option>
                  <option value="collaborator">Collaborator</option>
                  <option value="institution">Institution</option>
                </select>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {currentPipelineStages.map((s) => (
                    <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 flex-shrink-0 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedContact}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

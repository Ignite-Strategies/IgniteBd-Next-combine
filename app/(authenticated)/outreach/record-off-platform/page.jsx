'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, FileText, Plus, X, Check, Loader2, Mail, Calendar, MessageSquare } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector';
import api from '@/lib/api';

export default function RecordOffPlatformPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : '') || '';
  const contactIdFromUrl = searchParams?.get('contactId') || '';
  
  const [mode, setMode] = useState('manual'); // Default to manual when coming from contact detail
  const [contact, setContact] = useState(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvRows, setCsvRows] = useState([]);
  const [parsingError, setParsingError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Load contact if contactId provided
  useEffect(() => {
    if (contactIdFromUrl) {
      setLoadingContact(true);
      api.get(`/api/contacts/${contactIdFromUrl}`)
        .then((response) => {
          if (response.data?.success && response.data.contact) {
            setContact(response.data.contact);
            // Pre-fill manual entry with contact email
            setManualEntry(prev => ({
              ...prev,
              email: response.data.contact.email || '',
            }));
            // Also set selected contact so ContactSelector shows it
            if (response.data.contact.email) {
              setSelectedContactForEmail(response.data.contact);
            }
          }
        })
        .catch((error) => {
          console.error('Error loading contact:', error);
        })
        .finally(() => {
          setLoadingContact(false);
        });
    }
  }, [contactIdFromUrl]);
  
  // Manual entry form
  const [manualEntry, setManualEntry] = useState({
    email: '',
    subject: '',
    body: '',
    emailSent: new Date().toISOString().split('T')[0],
    platform: 'manual',
    notes: '',
  });
  const [emailBlob, setEmailBlob] = useState('');
  const [parsedEmail, setParsedEmail] = useState(null);
  const [selectedContactForEmail, setSelectedContactForEmail] = useState(null);
  
  // Handle file upload
  const handleFileUpload = async (file) => {
    setUploading(true);
    setParsingError('');
    setErrors([]);
    
    try {
      const text = await file.text();
      setCsvText(text);
      const rows = parseCSV(text);
      setCsvRows(rows);
      setCsvFile(file);
      setParsingError('');
    } catch (error) {
      setParsingError(error.message);
      setCsvRows([]);
    } finally {
      setUploading(false);
    }
  };
  
  // CSV parsing
  const parseCSV = (text) => {
    try {
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const subjectIndex = headers.findIndex(h => h.includes('subject'));
      const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('sent'));
      const platformIndex = headers.findIndex(h => h.includes('platform'));
      const notesIndex = headers.findIndex(h => h.includes('note'));
      
      if (emailIndex === -1) {
        throw new Error('CSV must have an "email" column');
      }
      
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values[emailIndex] && values[emailIndex].includes('@')) {
          rows.push({
            email: values[emailIndex],
            subject: subjectIndex >= 0 ? values[subjectIndex] : '',
            emailSent: dateIndex >= 0 ? values[dateIndex] : new Date().toISOString().split('T')[0],
            platform: platformIndex >= 0 ? values[platformIndex] : 'manual',
            notes: notesIndex >= 0 ? values[notesIndex] : '',
          });
        }
      }
      
      return rows;
    } catch (error) {
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
  };
  
  const handleCSVParse = () => {
    setParsingError('');
    setErrors([]);
    
    if (!csvText.trim()) {
      setParsingError('Please paste CSV data');
      return;
    }
    
    try {
      const rows = parseCSV(csvText);
      setCsvRows(rows);
      setParsingError('');
    } catch (error) {
      setParsingError(error.message);
      setCsvRows([]);
    }
  };
  
  // Find or create contact by email
  const findOrCreateContact = async (email) => {
    try {
      // Try to find existing contact
      const response = await api.get(`/api/contacts/by-email?email=${encodeURIComponent(email)}`);
      if (response.data?.success && response.data.contact) {
        return response.data.contact.id;
      }
      
      // Create new contact if not found
      if (companyHQId) {
        const createResponse = await api.post('/api/contacts/create', {
          email,
          companyHQId,
        });
        if (createResponse.data?.success && createResponse.data.contact) {
          return createResponse.data.contact.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding/creating contact:', error);
      return null;
    }
  };
  
  // Save CSV rows
  const handleSaveCSV = async () => {
    if (csvRows.length === 0) {
      setParsingError('Please parse CSV data first');
      return;
    }
    
    setSaving(true);
    setErrors([]);
    setSavedCount(0);
    
    const newErrors = [];
    let saved = 0;
    
    for (const row of csvRows) {
      try {
        const contactId = await findOrCreateContact(row.email);
        if (!contactId) {
          newErrors.push(`Failed to find/create contact for ${row.email}`);
          continue;
        }
        
        const response = await api.post(`/api/contacts/${contactId}/off-platform-send`, {
          emailSent: row.emailSent,
          subject: row.subject || null,
          platform: row.platform || 'manual',
          notes: row.notes || null,
        });
        
        if (response.data?.success) {
          saved++;
        } else {
          newErrors.push(`Failed to save email for ${row.email}: ${response.data?.error || 'Unknown error'}`);
        }
      } catch (error) {
        newErrors.push(`Error processing ${row.email}: ${error.response?.data?.error || error.message}`);
      }
    }
    
    setSavedCount(saved);
    setErrors(newErrors);
    setSaving(false);
    
    if (saved > 0) {
      // Clear CSV after successful save
      setTimeout(() => {
        setCsvText('');
        setCsvRows([]);
      }, 2000);
    }
  };
  
  // Parse email blob (Outlook/Gmail format)
  const parseEmailBlob = (blob) => {
    const result = {
      from: '',
      fromEmail: '',
      to: '',
      toEmail: '',
      sent: '',
      subject: '',
      body: '',
    };
    
    // Extract From
    const fromMatch = blob.match(/From:\s*(.+?)(?:\n|$)/i);
    if (fromMatch) {
      const fromLine = fromMatch[1].trim();
      // Try to extract email if in format "Name <email>"
      const emailMatch = fromLine.match(/<(.+?)>/);
      if (emailMatch) {
        result.fromEmail = emailMatch[1];
        result.from = fromLine.replace(/<.+?>/, '').trim();
      } else {
        result.from = fromLine;
        // Check if it's just an email
        if (fromLine.includes('@')) {
          result.fromEmail = fromLine;
        }
      }
    }
    
    // Extract Sent date
    const sentMatch = blob.match(/Sent:\s*(.+?)(?:\n|$)/i);
    if (sentMatch) {
      const sentLine = sentMatch[1].trim();
      // Try to parse date (various formats)
      const dateMatch = sentLine.match(/(\w+day,?\s+)?(\w+\s+\d+,?\s+\d{4})/i) || 
                       sentLine.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) ||
                       sentLine.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        try {
          const date = new Date(dateMatch[0]);
          if (!isNaN(date.getTime())) {
            result.sent = date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Keep original if parsing fails
          result.sent = sentLine;
        }
      } else {
        result.sent = sentLine;
      }
    }
    
    // Extract To
    const toMatch = blob.match(/To:\s*(.+?)(?:\n|$)/i);
    if (toMatch) {
      const toLine = toMatch[1].trim();
      // Try to extract email if in format "Name <email>"
      const emailMatch = toLine.match(/<(.+?)>/);
      if (emailMatch) {
        result.toEmail = emailMatch[1];
        result.to = toLine.replace(/<.+?>/, '').trim();
      } else {
        result.to = toLine;
        // Check if it's just an email
        if (toLine.includes('@')) {
          result.toEmail = toLine;
        }
      }
    }
    
    // Extract Subject
    const subjectMatch = blob.match(/Subject:\s*(.+?)(?:\n|$)/i);
    if (subjectMatch) {
      result.subject = subjectMatch[1].trim();
    }
    
    // Extract body (everything after Subject or To, before signature)
    const bodyStart = blob.search(/(Subject|To):\s*.+?\n\n/i);
    if (bodyStart !== -1) {
      const afterHeaders = blob.substring(bodyStart);
      const bodyMatch = afterHeaders.match(/\n\n(.+?)(?:\n\n|\n[A-Z][a-z]+ [A-Z]|$)/s);
      if (bodyMatch) {
        result.body = bodyMatch[1].trim();
      } else {
        // Fallback: everything after headers
        const lines = blob.split('\n');
        let bodyStartIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^(Subject|To|From|Sent):/i)) {
            bodyStartIndex = i + 1;
          } else if (bodyStartIndex > 0 && lines[i].trim() && !lines[i].match(/^[A-Z][a-z]+ [A-Z]/)) {
            break;
          }
        }
        result.body = lines.slice(bodyStartIndex).join('\n').trim();
      }
    }
    
    return result;
  };
  
  const handleParseEmailBlob = async () => {
    if (!emailBlob.trim()) {
      setParsingError('Please paste email content');
      return;
    }
    
    try {
      const parsed = parseEmailBlob(emailBlob);
      setParsedEmail(parsed);
      
      // Auto-fill form with parsed data
      if (parsed.toEmail) {
        setManualEntry({
          email: parsed.toEmail,
          subject: parsed.subject || '',
          body: parsed.body || '',
          emailSent: parsed.sent || new Date().toISOString().split('T')[0],
          platform: 'manual',
          notes: '',
        });
        
        // If no contactId from URL, try to find contact by email automatically
        if (!contactIdFromUrl && parsed.toEmail) {
          try {
            const response = await api.get(`/api/contacts/by-email?email=${encodeURIComponent(parsed.toEmail)}`);
            if (response.data?.success && response.data.contact) {
              setSelectedContactForEmail(response.data.contact);
              setParsingError('');
              return; // Found contact, exit early
            }
          } catch (error) {
            // Contact not found - that's okay, user can select manually
            console.log('Contact not found by email, user can select manually');
          }
        }
        
        // Clear selected contact if we found email but no contactId
        if (!contactIdFromUrl) {
          setSelectedContactForEmail(null);
        }
      } else {
        // If no email found, keep current manual entry but clear email field
        // User will need to select contact manually
        setManualEntry(prev => ({
          ...prev,
          email: '',
          subject: parsed.subject || prev.subject,
          body: parsed.body || prev.body,
          emailSent: parsed.sent || prev.emailSent,
        }));
      }
      
      setParsingError('');
    } catch (error) {
      setParsingError(`Failed to parse email: ${error.message}`);
      setParsedEmail(null);
    }
  };
  
  // Handle contact selection for email blob
  const handleContactSelectForEmail = (contact) => {
    setSelectedContactForEmail(contact);
    if (contact && contact.email) {
      setManualEntry(prev => ({
        ...prev,
        email: contact.email,
      }));
    }
  };
  
  // Save manual entry
  const handleSaveManual = async () => {
    // Determine which contact to use
    let targetContactId = contactIdFromUrl;
    let targetEmail = manualEntry.email;
    
    // Priority: selected contact > contactId from URL > email lookup
    if (selectedContactForEmail?.id) {
      targetContactId = selectedContactForEmail.id;
      targetEmail = selectedContactForEmail.email;
    } else if (contactIdFromUrl && contact) {
      targetContactId = contactIdFromUrl;
      targetEmail = contact.email;
    } else if (!targetEmail || !targetEmail.includes('@')) {
      setParsingError('Please select a contact or enter a valid email address');
      return;
    }
    
    // If we have contactId, use it directly
    if (targetContactId) {
      setSaving(true);
      setErrors([]);
      
      try {
        const response = await api.post(`/api/contacts/${targetContactId}/off-platform-send`, {
          emailSent: manualEntry.emailSent,
          subject: manualEntry.subject || null,
          body: manualEntry.body || null,
          platform: manualEntry.platform || 'manual',
          notes: manualEntry.notes || null,
        });
        
        if (response.data?.success) {
          setSavedCount(1);
          // Navigate back to contact detail page if we came from there
          if (contactIdFromUrl) {
            setTimeout(() => {
              const url = companyHQId 
                ? `/contacts/${targetContactId}?companyHQId=${companyHQId}`
                : `/contacts/${targetContactId}`;
              router.push(url);
            }, 1500);
          }
        } else {
          setErrors([response.data?.error || 'Failed to save email']);
        }
      } catch (error) {
        setErrors([error.response?.data?.error || error.message || 'Failed to save email']);
      } finally {
        setSaving(false);
      }
      return;
    }
    
    // Otherwise, find or create contact by email
    if (!targetEmail || !targetEmail.includes('@')) {
      setParsingError('Please select a contact or enter a valid email address');
      return;
    }
    
    setSaving(true);
    setErrors([]);
    
    try {
      const contactId = await findOrCreateContact(targetEmail);
      if (!contactId) {
        setErrors(['Failed to find/create contact']);
        setSaving(false);
        return;
      }
      
      const response = await api.post(`/api/contacts/${contactId}/off-platform-send`, {
        emailSent: manualEntry.emailSent,
        subject: manualEntry.subject || null,
        body: manualEntry.body || null,
        platform: manualEntry.platform || 'manual',
        notes: manualEntry.notes || null,
      });
      
      if (response.data?.success) {
        setSavedCount(1);
        // Reset form
        setManualEntry({
          email: '',
          subject: '',
          body: '',
          emailSent: new Date().toISOString().split('T')[0],
          platform: 'manual',
          notes: '',
        });
      } else {
        setErrors([response.data?.error || 'Failed to save email']);
      }
    } catch (error) {
      setErrors([error.response?.data?.error || error.message || 'Failed to save email']);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Record Off-Platform Emails"
          subtitle={contact 
            ? `Track emails sent to ${contact.goesBy || `${contact.firstName} ${contact.lastName}`.trim() || contact.email} outside the platform`
            : "Track emails sent outside the platform (Gmail, Outlook, CSV export, etc.)"
          }
          backTo={contactIdFromUrl 
            ? `${companyHQId ? `/contacts/${contactIdFromUrl}?companyHQId=${companyHQId}` : `/contacts/${contactIdFromUrl}`}`
            : (companyHQId ? `/outreach?companyHQId=${companyHQId}` : '/outreach')
          }
          backLabel={contactIdFromUrl ? 'Back to Contact' : 'Back to Outreach'}
        />
        
        {/* Mode Toggle */}
        <div className="mb-6 flex gap-2 rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode('csv')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === 'csv'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="mr-2 inline h-4 w-4" />
            CSV Import
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Manual Entry
          </button>
        </div>
        
        {/* CSV Mode */}
        {mode === 'csv' && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">CSV Import</h3>
            <p className="mb-4 text-sm text-gray-600">
              Upload a CSV file or paste CSV data with columns: <strong>email</strong> (required), subject, date, platform, notes
            </p>
            
            {/* File Upload */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Upload CSV File
              </label>
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  Choose File
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                {csvFile && (
                  <span className="text-sm text-gray-600">
                    {csvFile.name} ({csvRows.length} rows)
                  </span>
                )}
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
            </div>
            
            <div className="mb-4 flex items-center gap-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
            
            {/* Paste CSV */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Paste CSV Data
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="email,subject,date,platform,notes&#10;john@example.com,Follow up,2025-02-20,gmail,Met at conference&#10;jane@example.com,Introduction,2025-02-21,outlook,"
                className="w-full min-h-[200px] rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={handleCSVParse}
                disabled={!csvText.trim() || uploading}
                className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                Parse CSV
              </button>
            </div>
            
            {parsingError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {parsingError}
              </div>
            )}
            
            {csvRows.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-sm font-semibold text-gray-700">
                  Found {csvRows.length} email{csvRows.length !== 1 ? 's' : ''}
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Subject</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Platform</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-900">{row.email}</td>
                          <td className="px-3 py-2 text-gray-600">{row.subject || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.emailSent}</td>
                          <td className="px-3 py-2 text-gray-600">{row.platform || 'manual'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCSV}
                  disabled={saving}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save {csvRows.length} Email{csvRows.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Manual Entry Mode */}
        {mode === 'manual' && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Manual Entry</h3>
            {contact && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-blue-900">Recording email for:</div>
                    <div className="text-blue-700">
                      {contact.goesBy || `${contact.firstName} ${contact.lastName}`.trim() || contact.email}
                      {contact.email && ` (${contact.email})`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Clear contact and allow selection
                      setContact(null);
                      setSelectedContactForEmail(null);
                      setManualEntry(prev => ({
                        ...prev,
                        email: '',
                      }));
                      // Update URL to remove contactId
                      const params = new URLSearchParams(searchParams?.toString() || '');
                      params.delete('contactId');
                      const newUrl = params.toString() 
                        ? `${window.location.pathname}?${params.toString()}`
                        : window.location.pathname;
                      router.replace(newUrl);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    title="Switch to a different contact"
                  >
                    <X className="h-3 w-3" />
                    Switch Contact
                  </button>
                </div>
              </div>
            )}
            <p className="mb-4 text-sm text-gray-600">
              Paste email content (Outlook/Gmail format) and we'll auto-extract the details, or fill out the form manually.
            </p>
            
            {/* Email Blob Paste */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Paste Email Content
              </label>
              <textarea
                value={emailBlob}
                onChange={(e) => setEmailBlob(e.target.value)}
                placeholder="From: Your Name <your.email@example.com>&#10;Sent: Monday, January 15, 2024 2:30 PM&#10;To: Contact Name <contact@example.com>&#10;Subject: Follow-up on our conversation&#10;&#10;Hi there,&#10;&#10;Just following up on our previous discussion..."
                className="w-full min-h-[200px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleParseEmailBlob}
                disabled={!emailBlob.trim()}
                className="mt-2 flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                Parse Email
              </button>
              
              {parsedEmail && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                  <div className="mb-2 font-semibold text-green-800">Parsed:</div>
                  <div className="space-y-1 text-green-700">
                    {parsedEmail.toEmail ? (
                      <div>To: {parsedEmail.toEmail}</div>
                    ) : (
                      <div className="text-orange-700">⚠️ Could not determine recipient email - please select contact below</div>
                    )}
                    {parsedEmail.subject && <div>Subject: {parsedEmail.subject}</div>}
                    {parsedEmail.sent && <div>Sent: {parsedEmail.sent}</div>}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mb-4 flex items-center gap-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
            
            <div className="space-y-4">
              {/* Contact Selection - Show if no email found from parsing or if no contactId from URL */}
              {(!parsedEmail?.toEmail || !contactIdFromUrl) && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Select Contact {!parsedEmail?.toEmail && !contactIdFromUrl && <span className="text-red-500">*</span>}
                  </label>
                  <ContactSelector
                    companyHQId={companyHQId || undefined}
                    onContactSelect={handleContactSelectForEmail}
                    selectedContact={selectedContactForEmail || contact}
                    placeholder="Search for contact..."
                    showLabel={false}
                  />
                  {selectedContactForEmail && (
                    <p className="mt-1 text-xs text-green-600">
                      ✓ Selected: {selectedContactForEmail.goesBy || `${selectedContactForEmail.firstName} ${selectedContactForEmail.lastName}`.trim() || selectedContactForEmail.email}
                    </p>
                  )}
                  {contact && !selectedContactForEmail && contactIdFromUrl && (
                    <p className="mt-1 text-xs text-gray-500">
                      Current contact: {contact.goesBy || `${contact.firstName} ${contact.lastName}`.trim() || contact.email}
                    </p>
                  )}
                  {parsedEmail?.toEmail && !selectedContactForEmail && !contactIdFromUrl && (
                    <p className="mt-1 text-xs text-gray-500">
                      Email found in pasted content. Select a contact above to match it, or the email will be used to find/create a contact.
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Contact Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={manualEntry.email}
                  onChange={(e) => setManualEntry({ ...manualEntry, email: e.target.value })}
                  placeholder={parsedEmail?.toEmail ? parsedEmail.toEmail : "john@example.com"}
                  disabled={!!contactIdFromUrl || !!selectedContactForEmail}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {contactIdFromUrl && (
                  <p className="mt-1 text-xs text-gray-500">
                    Email is locked to the selected contact
                  </p>
                )}
                {selectedContactForEmail && !contactIdFromUrl && (
                  <p className="mt-1 text-xs text-gray-500">
                    Email is set from selected contact
                  </p>
                )}
                {parsedEmail?.toEmail && !contactIdFromUrl && !selectedContactForEmail && (
                  <p className="mt-1 text-xs text-blue-600">
                    ✓ Email extracted from pasted content
                  </p>
                )}
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Subject
                </label>
                <input
                  type="text"
                  value={manualEntry.subject}
                  onChange={(e) => setManualEntry({ ...manualEntry, subject: e.target.value })}
                  placeholder="Email subject line"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Email Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={manualEntry.body}
                  onChange={(e) => setManualEntry({ ...manualEntry, body: e.target.value })}
                  placeholder="Paste or type the email body content here..."
                  className="w-full min-h-[200px] rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Date Sent <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={manualEntry.emailSent}
                    onChange={(e) => setManualEntry({ ...manualEntry, emailSent: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Platform
                  </label>
                  <select
                    value={manualEntry.platform}
                    onChange={(e) => setManualEntry({ ...manualEntry, platform: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manual">Manual</option>
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="apollo">Apollo</option>
                    <option value="csv">CSV Export</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Notes
                </label>
                <textarea
                  value={manualEntry.notes}
                  onChange={(e) => setManualEntry({ ...manualEntry, notes: e.target.value })}
                  placeholder="Any additional notes about this email..."
                  className="w-full min-h-[100px] rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                type="button"
                onClick={handleSaveManual}
                disabled={saving || !manualEntry.email || !manualEntry.body}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Email Record
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Success/Error Messages */}
        {savedCount > 0 && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700">
            ✓ Successfully saved {savedCount} email{savedCount !== 1 ? 's' : ''}
          </div>
        )}
        
        {errors.length > 0 && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="mb-2 text-sm font-semibold text-red-800">Errors:</div>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
              {errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

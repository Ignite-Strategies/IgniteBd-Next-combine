'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, FileText, Plus, X, Check, Loader2, Mail, Calendar, MessageSquare, Download } from 'lucide-react';
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
  const loadedContactIdRef = useRef(null); // Track which contact we've loaded to prevent unnecessary reloads
  const [csvText, setCsvText] = useState('');
  const [csvRows, setCsvRows] = useState([]);
  const [parsingError, setParsingError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Load contact if contactId provided (but allow switching)
  // Only runs when contactIdFromUrl changes and is present
  useEffect(() => {
    // Only load if we have a contactId and haven't loaded it yet
    if (!contactIdFromUrl) {
      return; // Don't clear state - let user type freely
    }
    
    // Skip if we already have this contact loaded
    if (loadedContactIdRef.current === contactIdFromUrl) {
      return;
    }
    
    setLoadingContact(true);
    const currentContactId = contactIdFromUrl; // Capture for closure
    api.get(`/api/contacts/${currentContactId}`)
      .then((response) => {
        if (response.data?.success && response.data.contact) {
          const loadedContact = response.data.contact;
          // Only update if this is still the current contactId
          if (currentContactId === contactIdFromUrl && loadedContact.id === currentContactId) {
            loadedContactIdRef.current = loadedContact.id;
            setContact(loadedContact);
            setSelectedContactForEmail(loadedContact);
            // Pre-fill manual entry with contact email
            setManualEntry(prev => ({
              ...prev,
              email: loadedContact.email || '',
            }));
          }
        }
      })
      .catch((error) => {
        console.error('Error loading contact:', error);
        // Only clear if this is still the current contactId
        if (currentContactId === contactIdFromUrl) {
          loadedContactIdRef.current = null;
          setContact(null);
          setSelectedContactForEmail(null);
        }
      })
      .finally(() => {
        if (currentContactId === contactIdFromUrl) {
          setLoadingContact(false);
        }
      });
  }, [contactIdFromUrl]); // Only depend on contactIdFromUrl
  
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
  const [emailCandidates, setEmailCandidates] = useState([]); // Multiple domain-match candidates
  const [fuzzyContact, setFuzzyContact] = useState(null); // Single domain-match suggestion
  
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
  
  // CSV parsing - properly handles multi-line quoted fields
  const parseCSV = (text) => {
    try {
      if (!text || !text.trim()) {
        throw new Error('CSV text is empty');
      }
      
      // Parse CSV properly handling quoted fields with newlines
      const rows = [];
      let currentRow = [];
      let currentField = '';
      let inQuotes = false;
      let i = 0;
      
      while (i < text.length) {
        const char = text[i];
        const nextChar = i + 1 < text.length ? text[i + 1] : null;
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote ("")
            currentField += '"';
            i += 2;
            continue;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
            i++;
            continue;
          }
        }
        
        if (char === ',' && !inQuotes) {
          // End of field
          currentRow.push(currentField.trim());
          currentField = '';
          i++;
          continue;
        }
        
        if ((char === '\n' || char === '\r') && !inQuotes) {
          // End of row (but skip \r\n combination)
          if (char === '\r' && nextChar === '\n') {
            i += 2;
          } else {
            i++;
          }
          
          // Only process if we have content
          if (currentRow.length > 0 || currentField.trim()) {
            if (currentField.trim() || currentRow.length > 0) {
              currentRow.push(currentField.trim());
              currentField = '';
            }
            
            if (currentRow.length > 0) {
              rows.push(currentRow);
              currentRow = [];
            }
          }
          continue;
        }
        
        // Regular character
        currentField += char;
        i++;
      }
      
      // Add last field and row if any
      if (currentField.trim() || currentRow.length > 0) {
        currentRow.push(currentField.trim());
      }
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      
      if (rows.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }
      
      // Parse headers
      const headers = rows[0].map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      const firstNameIndex = headers.findIndex(h => h.includes('first') && h.includes('name'));
      const lastNameIndex = headers.findIndex(h => h.includes('last') && h.includes('name'));
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const subjectIndex = headers.findIndex(h => h.includes('subject'));
      const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('sent'));
      const bodyIndex = headers.findIndex(h => h.includes('body'));
      const platformIndex = headers.findIndex(h => h.includes('platform'));
      const notesIndex = headers.findIndex(h => h.includes('note'));
      
      if (emailIndex === -1) {
        throw new Error('CSV must have an "email" column');
      }
      
      // Parse data rows
      const parsedRows = [];
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        
        // Ensure we have enough values (pad with empty strings if needed)
        while (values.length < headers.length) {
          values.push('');
        }
        
        // Remove surrounding quotes from email
        const email = values[emailIndex] ? values[emailIndex].replace(/^["']|["']$/g, '').trim() : '';
        
        if (email && email.includes('@')) {
          parsedRows.push({
            firstName: firstNameIndex >= 0 && values[firstNameIndex] ? values[firstNameIndex].replace(/^["']|["']$/g, '').trim() : '',
            lastName: lastNameIndex >= 0 && values[lastNameIndex] ? values[lastNameIndex].replace(/^["']|["']$/g, '').trim() : '',
            email: email,
            subject: subjectIndex >= 0 && values[subjectIndex] ? values[subjectIndex].replace(/^["']|["']$/g, '').trim() : '',
            body: bodyIndex >= 0 && values[bodyIndex] ? values[bodyIndex].replace(/^["']|["']$/g, '').trim() : '',
            emailSent: dateIndex >= 0 && values[dateIndex] ? values[dateIndex].replace(/^["']|["']$/g, '').trim() : new Date().toISOString().split('T')[0],
            platform: platformIndex >= 0 && values[platformIndex] ? values[platformIndex].replace(/^["']|["']$/g, '').trim() : 'manual',
            notes: notesIndex >= 0 && values[notesIndex] ? values[notesIndex].replace(/^["']|["']$/g, '').trim() : '',
          });
        }
      }
      
      return parsedRows;
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
    if (!email || !email.includes('@')) {
      return null;
    }
    
    try {
      // Try to find existing contact
      const response = await api.get(`/api/contacts/by-email?email=${encodeURIComponent(email)}`);
      if (response.data?.success && response.data.contact) {
        return response.data.contact.id;
      }
      
      // If 404 (not found), try to create
      if (response.status === 404 || !response.data?.success) {
        // Create new contact if not found
        if (companyHQId) {
          try {
            const createResponse = await api.post('/api/contacts/create', {
              email,
              companyHQId,
            });
            if (createResponse.data?.success && createResponse.data.contact) {
              return createResponse.data.contact.id;
            }
          } catch (createError) {
            // Log but don't throw - we'll return null
            console.error('Error creating contact:', createError);
          }
        }
      }
      
      return null;
    } catch (error) {
      // Handle 500 errors gracefully - don't retry or throw
      if (error.response?.status === 500) {
        console.error(`Server error finding contact for ${email}:`, error.response?.data?.error || error.message);
        return null; // Return null instead of throwing to prevent stack overflow
      }
      
      // For other errors, also return null gracefully
      console.error('Error finding/creating contact:', error);
      return null;
    }
  };
  
  // Download CSV template
  const handleDownloadTemplate = () => {
    const template = `first name,last name,email,date of email,subject,body
John,Doe,john.doe@example.com,2026-02-24,Follow-up on our conversation,"Hi John,

Just following up on our previous discussion about the project. Let me know if you have any questions.

Best regards"`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'off-platform-email-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
    let skipped = 0;
    
    for (const row of csvRows) {
      try {
        // Validate email
        if (!row.email || !row.email.includes('@')) {
          newErrors.push(`Invalid email for row: ${row.email || 'missing'}`);
          skipped++;
          continue;
        }
        
        // Find or create contact by email, with firstName/lastName if provided
        let contactId = await findOrCreateContact(row.email);
        
        // If contact lookup failed, skip this row
        if (!contactId) {
          newErrors.push(`Could not find or create contact for ${row.email}. Please check if the email is valid and try again.`);
          skipped++;
          continue;
        }
        
        // If contact was created and we have firstName/lastName, update it
        if (contactId && (row.firstName || row.lastName)) {
          try {
            await api.put(`/api/contacts/${contactId}`, {
              firstName: row.firstName || undefined,
              lastName: row.lastName || undefined,
            });
          } catch (updateError) {
            console.warn('Could not update contact name:', updateError);
            // Continue anyway - name update is optional
          }
        }
        
        // Save the email record
        const response = await api.post(`/api/contacts/${contactId}/off-platform-send`, {
          emailSent: row.emailSent,
          subject: row.subject || null,
          body: row.body || null,
          platform: row.platform || 'manual',
          notes: row.notes || null,
        });
        
        if (response.data?.success) {
          saved++;
        } else {
          newErrors.push(`Failed to save email for ${row.email}: ${response.data?.error || 'Unknown error'}`);
          skipped++;
        }
      } catch (error) {
        // Handle different error types gracefully
        if (error.response?.status === 500) {
          newErrors.push(`Server error processing ${row.email}. Please try again later.`);
        } else {
          newErrors.push(`Error processing ${row.email}: ${error.response?.data?.error || error.message}`);
        }
        skipped++;
      }
    }
    
    setSavedCount(saved);
    setErrors(newErrors);
    setSaving(false);
    
    // Show summary
    if (saved > 0 && skipped === 0) {
      // All saved successfully - clear CSV
      setTimeout(() => {
        setCsvText('');
        setCsvRows([]);
        setCsvFile(null);
      }, 2000);
    } else if (saved > 0) {
      // Some saved, some failed - keep CSV for retry
      console.log(`Saved ${saved} emails, ${skipped} skipped due to errors`);
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
    
    // Extract body (everything after headers, before signature)
    const lines = blob.split('\n');
    let lastHeaderIndex = -1;
    
    // Find the last header line (Subject, To, From, Sent, Date)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^(From|To|Sent|Date|Subject):\s*/i)) {
        lastHeaderIndex = i;
      }
    }
    
    if (lastHeaderIndex >= 0) {
      // Body starts after the last header
      // Skip empty lines after headers
      let bodyStartIndex = lastHeaderIndex + 1;
      while (bodyStartIndex < lines.length && !lines[bodyStartIndex].trim()) {
        bodyStartIndex++;
      }
      
      // Extract body - include everything until we hit a clear signature pattern
      const bodyLines = [];
      let inSignature = false;
      
      for (let i = bodyStartIndex; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
        const nextNextLine = i < lines.length - 2 ? lines[i + 2] : '';
        
        // Detect signature patterns more carefully
        // Signature indicators:
        // 1. Closing phrases followed by name
        // 2. Name pattern followed by email/phone/company info
        if (!inSignature) {
          // Check for closing phrases
          if (line.match(/^(Best|Regards|Sincerely|Thanks|Thank you|Cheers),?\s*$/i)) {
            // If next line looks like a name, this is probably a signature
            if (nextLine.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/i)) {
              inSignature = true;
              break;
            }
          }
          
          // Check for name pattern followed by contact info
          if (line.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/i)) {
            // Check if next lines contain email, phone, or company info
            const hasEmail = nextLine.match(/@/) || nextNextLine.match(/@/);
            const hasPhone = nextLine.match(/\(\d{3}\)|^\d{3}-\d{3}-\d{4}/) || nextNextLine.match(/\(\d{3}\)|^\d{3}-\d{3}-\d{4}/);
            const hasCompany = nextLine.match(/LLC|Inc|Corp|Law|PLLC/i) || nextNextLine.match(/LLC|Inc|Corp|Law|PLLC/i);
            
            // If we have contact info, this is likely a signature
            // But only if we've already extracted some body content
            if ((hasEmail || hasPhone || hasCompany) && bodyLines.length > 0) {
              inSignature = true;
              break;
            }
          }
        }
        
        bodyLines.push(line);
      }
      
      result.body = bodyLines.join('\n').trim();
    } else {
      // No headers found - might be just body text
      // Try to extract any meaningful content
      result.body = blob.trim();
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
          setEmailCandidates([]);
          setFuzzyContact(null);
          try {
            const params = new URLSearchParams({ email: parsed.toEmail });
            if (companyHQId) params.set('companyHQId', companyHQId);
            const response = await api.get(`/api/contacts/by-email?${params.toString()}`);

            if (response.data?.success && response.data.contact) {
              if (response.data.fuzzy) {
                // Domain-based single match — surface as a suggestion, don't auto-select
                setFuzzyContact(response.data.contact);
              } else {
                // Exact match — auto-select
                setSelectedContactForEmail(response.data.contact);
              }
              setParsingError('');
              return;
            } else if (response.data?.fuzzy && response.data?.candidates?.length > 0) {
              // Multiple domain-match candidates — let user pick
              setEmailCandidates(response.data.candidates);
              setParsingError('');
              return;
            }
          } catch (error) {
            // Contact not found - that's okay, user can select manually
            console.log('Contact not found by email, user can select manually');
          }
        }
        
        // Clear fuzzy state and selected contact if we found email but no contactId
        if (!contactIdFromUrl) {
          setSelectedContactForEmail(null);
          setEmailCandidates([]);
          setFuzzyContact(null);
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
    if (contact?.id) {
      loadedContactIdRef.current = contact.id;
      setSelectedContactForEmail(contact);
      setContact(contact);
      setFuzzyContact(null);
      setEmailCandidates([]);
      if (contact.email) {
        setManualEntry(prev => ({
          ...prev,
          email: contact.email,
        }));
      }
      // Don't push contactId into the URL here — that would trigger the
      // useEffect fetch loop and cause re-renders while the user is typing.
      // contactId in the URL is only meaningful when navigating TO this page.
    } else {
      handleClearContact();
    }
  };
  
  // Confirm a fuzzy-matched contact as the selected contact
  const handleConfirmFuzzyContact = (candidate) => {
    loadedContactIdRef.current = candidate.id;
    setSelectedContactForEmail(candidate);
    setContact(candidate);
    setFuzzyContact(null);
    setEmailCandidates([]);
    if (candidate.email) {
      setManualEntry(prev => ({ ...prev, email: candidate.email }));
    }
  };
  
  // Clear all contact-related state
  const handleClearContact = () => {
    loadedContactIdRef.current = null;
    setContact(null);
    setSelectedContactForEmail(null);
    setFuzzyContact(null);
    setEmailCandidates([]);
    setManualEntry(prev => ({ ...prev, email: '' }));
    setEmailBlob('');
    setParsedEmail(null);
    // Clear contactId from URL
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('contactId');
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    router.replace(newUrl);
  };
  
  // Save manual entry
  const handleSaveManual = async () => {
    // Determine which contact to use
    let targetContactId = contactIdFromUrl;
    let targetEmail = manualEntry.email;
    
    // If we have fuzzy candidates pending confirmation, block save and prompt user
    if (!selectedContactForEmail && (fuzzyContact || emailCandidates.length > 0)) {
      setParsingError('Please confirm the contact match below before saving.');
      return;
    }
    
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
            : "Track outreach sent outside the platform (Gmail, Outlook, LinkedIn, in-person, etc.)"
          }
          backTo={contactIdFromUrl 
            ? `${companyHQId ? `/contacts/${contactIdFromUrl}?companyHQId=${companyHQId}` : `/contacts/${contactIdFromUrl}`}`
            : (companyHQId ? `/outreach?companyHQId=${companyHQId}` : '/outreach')
          }
          backLabel={contactIdFromUrl ? 'Back to Contact' : 'Back to Outreach'}
        />
        
        {/* Mode Toggle and Reset */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex flex-1 gap-2 rounded-lg border border-gray-200 bg-white p-1">
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
          {(contact || selectedContactForEmail || contactIdFromUrl) && (
            <button
              type="button"
              onClick={handleClearContact}
              className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              title="Clear contact and start fresh"
            >
              <X className="h-4 w-4" />
              Reset
            </button>
          )}
        </div>
        
        {/* CSV Mode */}
        {mode === 'csv' && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">CSV Import</h3>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                <Download className="h-4 w-4" />
                Download Template
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Upload a CSV file or paste CSV data with columns: <strong>first name, last name, email</strong> (required), <strong>date of email, subject, body</strong>
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
                placeholder="first name,last name,email,date of email,subject,body&#10;John,Doe,john.doe@example.com,2026-02-24,Follow-up,&quot;Hi John,&#10;&#10;Just following up...&quot;&#10;Jane,Smith,jane.smith@example.com,2026-02-25,Introduction,&quot;Hi Jane,&#10;&#10;Nice to meet you...&quot;"
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
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Subject</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Body</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Delivery Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-900">
                            {row.firstName || row.lastName 
                              ? `${row.firstName || ''} ${row.lastName || ''}`.trim() 
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-900">{row.email}</td>
                          <td className="px-3 py-2 text-gray-600">{row.emailSent}</td>
                          <td className="px-3 py-2 text-gray-600">{row.subject || '—'}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={row.body || ''}>
                            {row.body ? (row.body.length > 50 ? `${row.body.substring(0, 50)}...` : row.body) : '—'}
                          </td>
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
              
              {/* Fuzzy single match suggestion */}
              {fuzzyContact && !selectedContactForEmail && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="mb-2 font-semibold text-amber-800">Contact match found by domain</div>
                  <p className="mb-2 text-amber-700">
                    No contact has this exact email on file, but we found someone at the same company. Is this the right person?
                  </p>
                  <div className="mb-3 rounded-md border border-amber-200 bg-white p-2">
                    <span className="font-semibold text-gray-900">
                      {fuzzyContact.goesBy || `${fuzzyContact.firstName || ''} ${fuzzyContact.lastName || ''}`.trim() || fuzzyContact.email}
                    </span>
                    {fuzzyContact.title && <span className="ml-2 text-gray-500">&mdash; {fuzzyContact.title}</span>}
                    {fuzzyContact.companyName && <span className="ml-1 text-gray-500">at {fuzzyContact.companyName}</span>}
                    {fuzzyContact.email && <div className="mt-0.5 text-xs text-gray-400">{fuzzyContact.email}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmFuzzyContact(fuzzyContact)}
                      className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      <Check className="h-3 w-3" />
                      Yes, use this contact
                    </button>
                    <button
                      type="button"
                      onClick={() => setFuzzyContact(null)}
                      className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      No, search manually
                    </button>
                  </div>
                </div>
              )}
              
              {/* Multiple domain-match candidates */}
              {emailCandidates.length > 0 && !selectedContactForEmail && !fuzzyContact && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="mb-2 font-semibold text-amber-800">Multiple contacts found at this domain</div>
                  <p className="mb-2 text-amber-700">No exact email match. Select the correct contact:</p>
                  <div className="space-y-1.5">
                    {emailCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => handleConfirmFuzzyContact(candidate)}
                        className="flex w-full items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2 text-left hover:bg-amber-50"
                      >
                        <span>
                          <span className="font-semibold text-gray-900">
                            {candidate.goesBy || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email}
                          </span>
                          {candidate.title && <span className="ml-2 text-xs text-gray-500">{candidate.title}</span>}
                          {candidate.email && <div className="text-xs text-gray-400">{candidate.email}</div>}
                        </span>
                        <Check className="ml-2 h-4 w-4 shrink-0 text-amber-600" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailCandidates([])}
                    className="mt-2 text-xs text-amber-600 underline hover:text-amber-800"
                  >
                    Dismiss — I&apos;ll search manually
                  </button>
                </div>
              )}
            </div>
            
            <div className="mb-4 flex items-center gap-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
            
            <div className="space-y-4">
              {/* Contact Selection - ALWAYS show, allow switching */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Select Contact {!parsedEmail?.toEmail && <span className="text-red-500">*</span>}
                </label>
                <ContactSelector
                  companyHQId={companyHQId || undefined}
                  onContactSelect={handleContactSelectForEmail}
                  {...(selectedContactForEmail ? { selectedContact: selectedContactForEmail } : {})}
                  placeholder="Search for contact..."
                  showLabel={false}
                />
                {selectedContactForEmail && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-xs text-green-700">
                      ✓ Selected: {selectedContactForEmail.goesBy || `${selectedContactForEmail.firstName} ${selectedContactForEmail.lastName}`.trim() || selectedContactForEmail.email}
                      {selectedContactForEmail.email && ` (${selectedContactForEmail.email})`}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearContact}
                      className="text-green-700 hover:text-green-900"
                      title="Clear selection"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {parsedEmail?.toEmail && !selectedContactForEmail && (
                  <p className="mt-1 text-xs text-gray-500">
                    Email found in pasted content. Select a contact above to match it, or the email will be used to find/create a contact.
                  </p>
                )}
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Contact Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={manualEntry.email}
                  onChange={(e) => setManualEntry({ ...manualEntry, email: e.target.value })}
                  placeholder={parsedEmail?.toEmail ? parsedEmail.toEmail : selectedContactForEmail?.email || "john@example.com"}
                  disabled={!!selectedContactForEmail}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {selectedContactForEmail && (
                  <p className="mt-1 text-xs text-gray-500">
                    Email is set from selected contact. Clear contact selection above to edit manually.
                  </p>
                )}
                {parsedEmail?.toEmail && !selectedContactForEmail && (
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
                    Delivery Method
                  </label>
                  <select
                    value={manualEntry.platform}
                    onChange={(e) => setManualEntry({ ...manualEntry, platform: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="apollo">Apollo</option>
                    <option value="in-person">In-Person</option>
                    <option value="csv">CSV Export</option>
                    <option value="manual">Manual</option>
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
                disabled={saving || !manualEntry.email || !manualEntry.body || (!selectedContactForEmail && (fuzzyContact !== null || emailCandidates.length > 0))}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                title={(!selectedContactForEmail && (fuzzyContact !== null || emailCandidates.length > 0)) ? 'Confirm the contact match above before saving' : undefined}
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Search,
  Mail,
  Sparkles,
  X,
  Check,
  ArrowRight,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

export default function EnrichPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  const [mode, setMode] = useState('search'); // 'search', 'csv', 'microsoft'
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundContact, setFoundContact] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [csvContacts, setCsvContacts] = useState([]);
  const [microsoftContacts, setMicrosoftContacts] = useState([]);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  // Search for existing contact by email
  const handleSearchContact = useCallback(async () => {
    if (!searchEmail || !searchEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/api/contacts/by-email?email=${encodeURIComponent(searchEmail)}&companyHQId=${companyHQId}`);
      
      if (response.data?.success && response.data.contact) {
        setFoundContact(response.data.contact);
      } else {
        // Contact not found, create a placeholder for enrichment
        setFoundContact({
          email: searchEmail,
          id: null, // Will be created during enrichment
        });
      }
    } catch (error) {
      console.error('Error searching contact:', error);
      // Contact not found, create a placeholder
      setFoundContact({
        email: searchEmail,
        id: null,
      });
    } finally {
      setSearching(false);
    }
  }, [searchEmail, companyHQId]);

  // Handle CSV file upload
  const handleCsvFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      file.type !== 'text/csv' &&
      !file.name.toLowerCase().endsWith('.csv')
    ) {
      alert('Please select a CSV file.');
      return;
    }

    setCsvFile(file);
    parseCSV(file);
  };

  const parseCSV = async (file) => {
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV file must contain at least a header row and one data row');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const emailIdx = headers.findIndex((h) => h.includes('email'));

    if (emailIdx === -1) {
      alert('CSV must contain an email column');
      return;
    }

    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const email = values[emailIdx];
      if (email && email.includes('@')) {
        contacts.push({
          email,
          id: null, // Will be found or created during enrichment
        });
      }
    }

    setCsvContacts(contacts);
  };

  // Get contacts from Microsoft Graph
  const handleGetMicrosoftContacts = useCallback(async () => {
    setLoadingMicrosoft(true);
    try {
      // Check if user is authenticated with Microsoft
      const statusResponse = await api.get('/api/microsoft/status');
      
      if (!statusResponse.data?.isAuthenticated) {
        // Redirect to Microsoft login
        window.location.href = '/api/microsoft/login';
        return;
      }

      // Fetch contacts from Microsoft Graph
      const contactsResponse = await api.get('/api/microsoft-graph/contacts');
      
      if (contactsResponse.data?.success) {
        const contacts = (contactsResponse.data.contacts || []).map((contact) => {
          // Extract email from Microsoft Graph contact format
          const emailAddress = contact.emailAddresses?.[0]?.address || 
                               contact.mail || 
                               contact.userPrincipalName;
          
          if (!emailAddress) return null;

          return {
            email: emailAddress,
            firstName: contact.givenName || contact.firstName,
            lastName: contact.surname || contact.lastName,
            company: contact.companyName,
            title: contact.jobTitle,
            id: null, // Will be found or created during enrichment
          };
        }).filter(Boolean);

        setMicrosoftContacts(contacts);
        setMode('microsoft');
      }
    } catch (error) {
      console.error('Error fetching Microsoft contacts:', error);
      alert('Failed to fetch Microsoft contacts. Please try again.');
    } finally {
      setLoadingMicrosoft(false);
    }
  }, []);

  // Toggle contact selection
  const handleToggleContact = (email) => {
    setSelectedContacts((prev) => {
      const updated = new Set(prev);
      if (updated.has(email)) {
        updated.delete(email);
      } else {
        updated.add(email);
      }
      return updated;
    });
  };

  // Handle enrich action
  const handleEnrich = useCallback(async () => {
    const contactsToEnrich = [];
    
    if (mode === 'search' && foundContact) {
      contactsToEnrich.push({ email: foundContact.email, contactId: foundContact.id });
    } else if (mode === 'csv') {
      csvContacts
        .filter((c) => selectedContacts.has(c.email))
        .forEach((c) => contactsToEnrich.push({ email: c.email, contactId: c.id }));
    } else if (mode === 'microsoft') {
      microsoftContacts
        .filter((c) => selectedContacts.has(c.email))
        .forEach((c) => contactsToEnrich.push({ email: c.email, contactId: c.id }));
    }

    if (contactsToEnrich.length === 0) {
      alert('Please select at least one contact to enrich');
      return;
    }

    setEnriching(true);
    const enrichmentResults = [];

    try {
      // For each contact, find or create it, then enrich
      for (const { email, contactId } of contactsToEnrich) {
        try {
          let contact = null;
          
          if (contactId) {
            // Use existing contact
            contact = { id: contactId, email };
          } else {
            // Search for existing contact or create new one
            const searchResponse = await api.get(`/api/contacts/by-email?email=${encodeURIComponent(email)}&companyHQId=${companyHQId}`);
            
            if (searchResponse.data?.success && searchResponse.data.contact) {
              contact = searchResponse.data.contact;
            } else {
              // Create new contact
              const createResponse = await api.post('/api/contacts', {
                email,
                crmId: companyHQId,
              });
              if (createResponse.data?.success && createResponse.data.contact) {
                contact = createResponse.data.contact;
              }
            }
          }

          if (contact?.id) {
            // Enrich the contact
            const enrichResponse = await api.post('/api/contacts/enrich', {
              contactId: contact.id,
              email: contact.email || email,
            });

            if (enrichResponse.data?.success) {
              enrichmentResults.push({
                email,
                success: true,
                contact: enrichResponse.data.contact,
                enrichedData: enrichResponse.data.enrichedData,
              });
            } else {
              enrichmentResults.push({
                email,
                success: false,
                error: enrichResponse.data?.error || 'Enrichment failed',
              });
            }
          }
        } catch (error) {
          console.error(`Error enriching ${email}:`, error);
          enrichmentResults.push({
            email,
            success: false,
            error: error.response?.data?.error || error.message || 'Enrichment failed',
          });
        }
      }

      // Navigate to success page with results
      const successData = {
        total: contactsToEnrich.length,
        successful: enrichmentResults.filter((r) => r.success).length,
        failed: enrichmentResults.filter((r) => !r.success).length,
        results: enrichmentResults,
      };

      // Store results in sessionStorage for success page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('enrichmentResults', JSON.stringify(successData));
      }

      router.push('/contacts/enrich/success');
    } catch (error) {
      console.error('Enrichment error:', error);
      alert('Failed to enrich contacts. Please try again.');
    } finally {
      setEnriching(false);
    }
  }, [mode, foundContact, csvContacts, microsoftContacts, selectedContacts, companyHQId, router]);

  const allContacts = mode === 'csv' ? csvContacts : mode === 'microsoft' ? microsoftContacts : [];
  const allSelected = allContacts.length > 0 && allContacts.every((c) => selectedContacts.has(c.email));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/contacts')}
            className="mb-4 flex items-center text-gray-600 transition hover:text-gray-900"
          >
            <ArrowRight className="mr-2 h-5 w-5 rotate-180" />
            Back to People Hub
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-gray-900">
                ✨ Enrich Contacts
              </h1>
              <p className="text-lg text-gray-600">
                Get more details on your contacts with Apollo enrichment
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setMode('search');
              setFoundContact(null);
              setSearchEmail('');
            }}
            className={`rounded-xl border-2 p-6 text-left transition ${
              mode === 'search'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Search className={`mb-3 h-8 w-8 ${mode === 'search' ? 'text-blue-600' : 'text-gray-400'}`} />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Search Contact
            </h3>
            <p className="text-sm text-gray-600">
              Search for a contact by email
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('csv');
              setCsvFile(null);
              setCsvContacts([]);
              setSelectedContacts(new Set());
            }}
            className={`rounded-xl border-2 p-6 text-left transition ${
              mode === 'csv'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <FileSpreadsheet className={`mb-3 h-8 w-8 ${mode === 'csv' ? 'text-green-600' : 'text-gray-400'}`} />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Upload CSV
            </h3>
            <p className="text-sm text-gray-600">
              Upload a CSV file with emails
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('microsoft');
              setMicrosoftContacts([]);
              setSelectedContacts(new Set());
            }}
            className={`rounded-xl border-2 p-6 text-left transition ${
              mode === 'microsoft'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Mail className={`mb-3 h-8 w-8 ${mode === 'microsoft' ? 'text-purple-600' : 'text-gray-400'}`} />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Microsoft Email
            </h3>
            <p className="text-sm text-gray-600">
              Get contacts from Microsoft email
            </p>
          </button>
        </div>

        {/* Search Mode */}
        {mode === 'search' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Search for a Contact
            </h2>
            <div className="flex gap-4">
              <input
                type="email"
                placeholder="Enter email address"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchContact()}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSearchContact}
                disabled={searching || !searchEmail}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? (
                  <>
                    <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 inline h-4 w-4" />
                    Search
                  </>
                )}
              </button>
            </div>

            {foundContact && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {foundContact.firstName} {foundContact.lastName}
                    </div>
                    <div className="text-sm text-gray-600">{foundContact.email}</div>
                    {foundContact.id && (
                      <div className="mt-2 text-xs text-gray-500">
                        Existing contact
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFoundContact(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CSV Mode */}
        {mode === 'csv' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Upload CSV File
            </h2>
            <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center transition-colors hover:border-gray-400">
              {!csvFile ? (
                <>
                  <Upload className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                  <p className="mb-2 text-gray-600">Click to upload or drag and drop</p>
                  <p className="mb-4 text-xs text-gray-500">CSV files only (must contain email column)</p>
                  <label className="inline-block cursor-pointer rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileSelect}
                      className="hidden"
                    />
                    Select CSV File
                  </label>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="font-semibold text-gray-900">{csvFile.name}</div>
                      <div className="text-sm text-gray-600">
                        {csvContacts.length} contact{csvContacts.length !== 1 ? 's' : ''} found
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvFile(null);
                      setCsvContacts([]);
                      setSelectedContacts(new Set());
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {csvContacts.length > 0 && (
              <div className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
                  <span className="font-semibold text-gray-900">
                    Select contacts to enrich
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        setSelectedContacts(new Set());
                      } else {
                        setSelectedContacts(new Set(csvContacts.map((c) => c.email)));
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {csvContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-gray-100 p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.email)}
                          onChange={() => handleToggleContact(contact.email)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="text-sm text-gray-900">{contact.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Microsoft Mode */}
        {mode === 'microsoft' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Get Contacts from Microsoft Email
            </h2>
            <button
              type="button"
              onClick={handleGetMicrosoftContacts}
              disabled={loadingMicrosoft}
              className="mb-6 rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMicrosoft ? (
                <>
                  <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Mail className="mr-2 inline h-4 w-4" />
                  Get Contacts from Microsoft
                </>
              )}
            </button>

            {microsoftContacts.length > 0 && (
              <div className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
                  <span className="font-semibold text-gray-900">
                    Select contacts to enrich ({microsoftContacts.length} found)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        setSelectedContacts(new Set());
                      } else {
                        setSelectedContacts(new Set(microsoftContacts.map((c) => c.email)));
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {microsoftContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-gray-100 p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.email)}
                          onChange={() => handleToggleContact(contact.email)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-xs text-gray-600">{contact.email}</div>
                          {contact.company && (
                            <div className="text-xs text-gray-500">{contact.company}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enrich Button */}
        {(foundContact || (allContacts.length > 0 && selectedContacts.size > 0)) && (
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ready to Enrich</h3>
                <p className="text-sm text-gray-600">
                  {mode === 'search'
                    ? '1 contact selected'
                    : `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} selected`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnrich}
                disabled={enriching}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-3 font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enriching ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Enrich
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

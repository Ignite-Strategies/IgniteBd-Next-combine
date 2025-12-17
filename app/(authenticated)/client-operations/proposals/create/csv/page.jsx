'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { Upload, FileText, CheckCircle, X, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

/**
 * Proposal CSV Upload Page
 * Upload a CSV to create a proposal with deliverables directly (bypasses templates)
 */
function ProposalCSVUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'success'
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);

  // Load companyHQId on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hqId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
      if (hqId) setCompanyHQId(hqId);
    }
  }, []);

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    }).filter(row => Object.values(row).some(v => v)); // Remove empty rows
    
    return { headers, rows };
  };

  // Validate CSV headers
  const validateHeaders = (headers) => {
    const required = ['phasename', 'deliverablename', 'deliverabledescription'];
    const missing = required.filter(req => !headers.includes(req));
    
    if (missing.length > 0) {
      return {
        valid: false,
        error: `Missing required columns: ${missing.join(', ')}`,
      };
    }
    
    return { valid: true };
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    try {
      const text = await selectedFile.text();
      const { headers, rows } = parseCSV(text);
      
      const validation = validateHeaders(headers);
      if (!validation.valid) {
        setError(validation.error);
        setFile(null);
        return;
      }

      // Map CSV rows to preview format
      const previewData = rows.slice(0, 5).map(row => ({
        phaseName: row.phasename || '',
        deliverableName: row.deliverablename || '',
        deliverableDescription: row.deliverabledescription || '',
        unit: row.unit || '',
        suggestedQuantity: row.suggestedquantity ? parseInt(row.suggestedquantity, 10) : null,
        durationUnit: row.durationunit || 'hour',
        durationUnits: row.durationunits ? parseInt(row.durationunits, 10) : null,
        proposalTitle: row.proposaltitle || '',
        proposalDescription: row.proposaledescription || '',
      }));

      setPreview({
        headers,
        rows: previewData,
        totalRows: rows.length,
        allRows: rows, // Store all rows for submission
      });
      setStep('preview');
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Failed to parse CSV file. Please check the format.');
      setFile(null);
    }
  };

  // Handle proposal creation
  const handleCreateProposal = async () => {
    if (!contactId || !companyId) {
      setError('Please select a contact and company');
      return;
    }

    if (!preview || !preview.allRows || preview.allRows.length === 0) {
      setError('No data to create proposal');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Map all rows to deliverable format
      const deliverables = preview.allRows.map(row => {
        const quantity = row.suggestedquantity ? parseInt(row.suggestedquantity, 10) : 1;
        const durationUnits = row.durationunits ? parseInt(row.durationunits, 10) : null;
        
        // Store extra fields in notes as JSON
        const notesData = {
          phaseName: row.phasename || '',
          unit: row.unit || null,
          durationUnit: row.durationunit || 'hour',
          durationUnits: durationUnits,
        };

        return {
          name: row.deliverablename || '',
          description: row.deliverabledescription || '',
          quantity: isNaN(quantity) ? 1 : quantity,
          notes: JSON.stringify(notesData),
        };
      });

      // Get proposal title/description from first row (or use defaults)
      const firstRow = preview.allRows[0];
      const proposalTitle = firstRow.proposaltitle || 'Untitled Proposal';
      const proposalDescription = firstRow.proposaledescription || '';

      // Create proposal via API
      const response = await api.post('/api/proposals/create/from-csv', {
        companyHQId,
        contactId,
        companyId,
        title: proposalTitle,
        description: proposalDescription,
        deliverables,
      });

      if (response.data?.success) {
        const proposalId = response.data.proposal.id;
        setStep('success');
        
        // Redirect after a brief delay
        setTimeout(() => {
          router.push(`/proposals/${proposalId}`);
        }, 1500);
      } else {
        setError(response.data?.error || 'Failed to create proposal');
      }
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setLoading(false);
    }
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const template = `Phase Name,Deliverable Name,Deliverable Description,Unit,Suggested Quantity,Duration Unit,Duration Units,Proposal Title,Proposal Description
Collateral Generation,Persona Development,Persona strategy and drafting,item,1,hour,3,Starter Package,Complete marketing package
Collateral Generation,CLE Deck,25-slide educational deck,item,1,hour,5,Starter Package,Complete marketing package
Enrichment & Automation Prep,Contact Enrichment,Apollo/Hunter enrichment,item,50,hour,2,Starter Package,Complete marketing package`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proposal-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Proposal Created Successfully!</h2>
            <p className="text-gray-600">Redirecting to your proposal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Preview Proposal"
            subtitle="Review your CSV data before creating the proposal"
            backTo="/client-operations/proposals/create"
            backLabel="Back to Options"
          />

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Contact/Company Selection */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Contact</h3>
            <div className="max-w-md">
              <ContactSelector
                contactId={contactId}
                onContactChange={(contact) => {
                  setSelectedContact(contact);
                  setContactId(contact.id);
                  // Get companyId from contact's company
                  if (contact.contactCompanyId) {
                    setCompanyId(contact.contactCompanyId);
                  } else if (contact.contactCompany?.id) {
                    setCompanyId(contact.contactCompany.id);
                  }
                }}
              />
            </div>
            {selectedContact && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800">
                  <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                  {selectedContact.contactCompany?.companyName && (
                    <span> • {selectedContact.contactCompany.companyName}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">CSV Preview</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Showing first 5 of {preview.totalRows} rows
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phase Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deliverable Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.rows.map((row, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.phaseName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.deliverableName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.deliverableDescription}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.suggestedQuantity || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-4">
            <button
              onClick={() => {
                setStep('upload');
                setPreview(null);
                setFile(null);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProposal}
              disabled={loading || !contactId || !companyId}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Proposal'}
            </button>
            {(!contactId || !companyId) && (
              <p className="text-xs text-gray-500 mt-2">
                Please select a contact to continue
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload From CSV"
          subtitle="Upload a CSV file to create a proposal with deliverables"
          backTo="/client-operations/proposals/create"
          backLabel="Back to Options"
        />

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-xl border-2 border-gray-200 bg-white p-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Proposal from CSV</h2>
            <p className="text-gray-600 mb-6">
              Upload a CSV file with phases and deliverables to automatically generate your proposal.
            </p>

            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={handleDownloadTemplate}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Download CSV Template
              </button>
              <label className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload CSV File
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {file && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800">
                  <strong>Selected:</strong> {file.name}
                </p>
              </div>
            )}

            <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6 text-left">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Required Columns:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Phase Name</li>
                <li>• Deliverable Name</li>
                <li>• Deliverable Description</li>
              </ul>
              <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-3">Optional Columns:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Unit</li>
                <li>• Suggested Quantity</li>
                <li>• Duration Unit</li>
                <li>• Duration Units</li>
                <li>• Proposal Title</li>
                <li>• Proposal Description</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProposalCSVUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ProposalCSVUploadContent />
    </Suspense>
  );
}

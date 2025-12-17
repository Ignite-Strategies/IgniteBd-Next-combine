'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import CompanySelector from '@/components/CompanySelector.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import CSVImportWizard from '@/components/workpackages/CSVImportWizard';
import { Upload, AlertCircle, Download, Building2, Users } from 'lucide-react';
import api from '@/lib/api';

interface Company {
  id: string;
  companyName: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Work Package CSV Upload Page
 * 4-step wizard: Upload → Map → Preview → Create
 */
function WorkPackageCSVUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Parse CSV file (handles quoted fields)
  const parseCSV = (text: string): ParsedCSV => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    // Handle quoted fields
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const values = parseLine(line).map(v => v.replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    }).filter(row => Object.values(row).some(v => v)); // Remove empty rows
    
    return { headers, rows };
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    try {
      const text = await selectedFile.text();
      const { headers, rows } = parseCSV(text);
      
      if (headers.length === 0) {
        setError('CSV file appears to be empty or invalid');
        setFile(null);
        return;
      }

      if (rows.length === 0) {
        setError('CSV file contains no data rows');
        setFile(null);
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      setShowWizard(true);
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Failed to parse CSV file. Please check the format.');
      setFile(null);
    }
  };

  // Handle wizard completion
  const handleWizardComplete = async (data: {
    workPackage: any;
    phases: any[];
    transformedRows: any[];
    mappings: Record<string, string>;
  }) => {
    if (!contactId) {
      setError('Please select a client contact first');
      return;
    }

    if (!companyId) {
      setError('Please select a company first');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Send to API with mapped data - use new company-first field names
      const response = await api.post('/api/workpackages/import/mapped', {
        workPackageClientId: contactId, // New field name
        companyId: companyId,
        workPackage: data.workPackage,
        phases: data.phases,
        transformedRows: data.transformedRows,
        mappings: data.mappings,
      });

      if (response.data?.success) {
        const newWorkPackage = response.data.workPackage;
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('workPackages');
          let workPackages: any[] = [];
          if (cached) {
            try {
              workPackages = JSON.parse(cached);
            } catch (err) {
              console.warn('Failed to parse cached work packages', err);
            }
          }
          workPackages = [newWorkPackage, ...workPackages];
          window.localStorage.setItem('workPackages', JSON.stringify(workPackages));
          
          // Also update company hydration cache if it exists
          const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
          if (companyHQId) {
            const hydrationKey = `companyHydration_${companyHQId}`;
            const hydrationData = window.localStorage.getItem(hydrationKey);
            if (hydrationData) {
              try {
                const parsed = JSON.parse(hydrationData);
                if (parsed.data) {
                  parsed.data.workPackages = [newWorkPackage, ...(parsed.data.workPackages || [])];
                  parsed.timestamp = new Date().toISOString();
                  window.localStorage.setItem(hydrationKey, JSON.stringify(parsed));
                }
              } catch (err) {
                console.warn('Failed to update company hydration cache', err);
              }
            }
          }
        }
        
        // Redirect to work package
        router.push(`/workpackages/${newWorkPackage.id}`);
      } else {
        setError(response.data?.error || 'Failed to create work package');
      }
    } catch (err: any) {
      console.error('Error creating work package:', err);
      setError(err.response?.data?.error || 'Failed to create work package');
    } finally {
      setLoading(false);
    }
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const template = `proposalTitle,proposalDescription,proposalTotalCost,effectiveStartDate,phaseName,phasePosition,phaseDescription,deliverableLabel,deliverableType,deliverableDescription,quantity,estimatedHoursEach,unitOfMeasure,status
"IgniteBD Starter Build-Out","Focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","2024-01-15","BD Strategic Setup",1,"Establish the strategic foundation for your BD system by defining targets, events, and opportunity landscape.","Target Personas",PERSONA,"Develop 3 persona profiles defining ideal BD targets.",3,4,persona,not_started
"IgniteBD Starter Build-Out","Focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","2024-01-15","BD Strategic Setup",1,"Establish the strategic foundation for your BD system by defining targets, events, and opportunity landscape.","Event Selection",EVENT,"Identify 6 key industry events most likely to generate BD opportunities.",6,1,event,not_started
"IgniteBD Starter Build-Out","Focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","2024-01-15","Initial Collateral",2,"Develop the core collateral assets needed to execute BD outreach.","Outreach Templates",TEMPLATE,"Draft 6 outreach templates tailored for warm, cold, and follow-up scenarios.",6,1,template,not_started
"IgniteBD Starter Build-Out","Focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","2024-01-15","Initial Collateral",2,"Develop the core collateral assets needed to execute BD outreach.","Blog Posts",BLOG,"Write 5 SEO-optimized blog posts to increase visibility and demonstrate thought leadership.",5,6,post,not_started`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'work-package-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (showWizard && csvHeaders.length > 0 && csvRows.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Import Work Package from CSV"
            subtitle="Map your CSV columns and preview the work package"
            backTo="/workpackages"
            backLabel="Back to Work Packages"
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

          {/* Company Selection (Step 1) */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Step 1: Select Company</h3>
            </div>
            <div className="max-w-md">
              <CompanySelector
                companyId={companyId}
                onCompanySelect={(company: Company | null) => {
                  setSelectedCompany(company);
                  setCompanyId(company?.id || '');
                  // Clear contact selection when company changes
                  setSelectedContact(null);
                  setContactId('');
                }}
                selectedCompany={selectedCompany}
                placeholder="Search companies by name..."
              />
              {selectedCompany && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-green-800">
                    ✓ <strong>Selected:</strong> {selectedCompany.companyName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contact Selection (Step 2) - Only shown after company is selected */}
          {selectedCompany && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Step 2: Select Client Contact</h3>
                <span className="text-xs text-gray-500">(from {selectedCompany.companyName})</span>
              </div>
              <div className="max-w-md">
                <ContactSelector
                  contactId={contactId}
                  companyId={companyId}
                  onContactSelect={(contact: Contact | null, company?: Company | null) => {
                    setSelectedContact(contact);
                    if (contact) {
                      setContactId(contact.id);
                    }
                    // Ensure companyId is set (should already be set from step 1)
                    if (company?.id) {
                      setCompanyId(company.id);
                    }
                  }}
                  onContactChange={(contact: Contact | null) => {
                    setSelectedContact(contact);
                    if (contact) {
                      setContactId(contact.id);
                    }
                  }}
                  selectedContact={selectedContact}
                />
                {selectedContact && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-sm text-green-800">
                      ✓ <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                      {selectedContact.email && <span> • {selectedContact.email}</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wizard - Only show if both company and contact are selected */}
          {selectedCompany && selectedContact && (
            <div className="mt-6">
              <CSVImportWizard
                csvHeaders={csvHeaders}
                csvRows={csvRows}
                onComplete={handleWizardComplete}
                contactId={contactId}
                companyId={companyId}
              />
            </div>
          )}
          
          {(!selectedCompany || !selectedContact) && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                ⚠️ Please complete both steps above (Select Company and Select Client Contact) before proceeding with the CSV import.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload Work Package CSV"
          subtitle="Upload a CSV file to create a work package with phases and deliverables"
          backTo="/workpackages"
          backLabel="Back to Work Packages"
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

        {/* Company Selection (Step 1) */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Step 1: Select Company</h3>
          </div>
          <div className="max-w-md">
            <CompanySelector
              companyId={companyId}
              onCompanySelect={(company: Company | null) => {
                setSelectedCompany(company);
                setCompanyId(company?.id || '');
                // Clear contact selection when company changes
                setSelectedContact(null);
                setContactId('');
              }}
              selectedCompany={selectedCompany}
              placeholder="Search companies by name..."
            />
            {selectedCompany && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm text-green-800">
                  ✓ <strong>Selected:</strong> {selectedCompany.companyName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Selection (Step 2) - Only shown after company is selected */}
        {selectedCompany && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Step 2: Select Client Contact</h3>
              <span className="text-xs text-gray-500">(from {selectedCompany.companyName})</span>
            </div>
            <div className="max-w-md">
              <ContactSelector
                contactId={contactId}
                companyId={companyId}
                onContactSelect={(contact: Contact | null, company?: Company | null) => {
                  setSelectedContact(contact);
                  if (contact) {
                    setContactId(contact.id);
                  }
                  // Ensure companyId is set (should already be set from step 1)
                  if (company?.id) {
                    setCompanyId(company.id);
                  }
                }}
                onContactChange={(contact: Contact | null) => {
                  setSelectedContact(contact);
                  if (contact) {
                    setContactId(contact.id);
                  }
                }}
                selectedContact={selectedContact}
              />
              {selectedContact && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-green-800">
                    ✓ <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                    {selectedContact.email && <span> • {selectedContact.email}</span>}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="mt-6 rounded-xl border-2 border-gray-200 bg-white p-8">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Create Work Package from CSV
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Upload a CSV file with phases and deliverables to automatically generate your work package.
            </p>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Download CSV Template
              </button>
              <label className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer">
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
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm text-green-800">
                  <strong>Selected:</strong> {file.name}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkPackageCSVPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <WorkPackageCSVUploadContent />
    </Suspense>
  );
}

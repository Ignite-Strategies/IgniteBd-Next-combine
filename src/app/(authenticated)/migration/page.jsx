'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function MigrationPage() {
  const [localStorageData, setLocalStorageData] = useState({});
  const [isScanning, setIsScanning] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [error, setError] = useState(null);

  // Scan localStorage on mount
  useEffect(() => {
    scanLocalStorage();
  }, []);

  const scanLocalStorage = () => {
    if (typeof window === 'undefined') return;

    const data = {
      companyHQ: null,
      owner: null,
      personas: [],
      contacts: [],
      products: [],
      proposals: [],
      phaseTemplates: [],
      deliverableTemplates: [],
      workPackages: [],
      presentations: [],
      blogs: [],
      templates: [],
      landingPages: [],
    };

    try {
      // Check for company hydration data
      const companyHQId = localStorage.getItem('companyHQId');
      
      // Try companyHydration key first
      if (companyHQId) {
        const hydrationKey = `companyHydration_${companyHQId}`;
        const hydrationData = localStorage.getItem(hydrationKey);
        if (hydrationData) {
          const parsed = JSON.parse(hydrationData);
          if (parsed.data) {
            data.companyHQ = parsed.data.companyHQ || null;
            data.personas = parsed.data.personas || [];
            data.contacts = parsed.data.contacts || [];
            data.products = parsed.data.products || [];
            data.proposals = parsed.data.proposals || [];
            data.phaseTemplates = parsed.data.phaseTemplates || [];
            data.deliverableTemplates = parsed.data.deliverableTemplates || [];
            data.workPackages = parsed.data.workPackages || [];
            data.presentations = parsed.data.presentations || [];
            data.blogs = parsed.data.blogs || [];
            data.templates = parsed.data.templates || [];
            data.landingPages = parsed.data.landingPages || [];
          }
        }
      }

      // Fallback: check individual keys
      const companyHQStr = localStorage.getItem('companyHQ');
      if (companyHQStr && !data.companyHQ) {
        data.companyHQ = JSON.parse(companyHQStr);
      }

      const ownerStr = localStorage.getItem('owner');
      if (ownerStr) {
        data.owner = JSON.parse(ownerStr);
      }

      // Check individual keys if hydration didn't work
      const personasStr = localStorage.getItem('personas');
      if (personasStr && data.personas.length === 0) {
        data.personas = JSON.parse(personasStr);
      }

      const contactsStr = localStorage.getItem('contacts');
      if (contactsStr && data.contacts.length === 0) {
        data.contacts = JSON.parse(contactsStr);
      }

      const productsStr = localStorage.getItem('products');
      if (productsStr && data.products.length === 0) {
        data.products = JSON.parse(productsStr);
      }

      const proposalsStr = localStorage.getItem('proposals');
      if (proposalsStr && data.proposals.length === 0) {
        data.proposals = JSON.parse(proposalsStr);
      }

      // Presentations
      const presentationsStr = localStorage.getItem('presentations');
      if (presentationsStr && data.presentations.length === 0) {
        data.presentations = JSON.parse(presentationsStr);
      }
      
      // Check company-specific presentations key
      if (companyHQId) {
        const presKey = `presentations_${companyHQId}`;
        const presStr = localStorage.getItem(presKey);
        if (presStr && data.presentations.length === 0) {
          data.presentations = JSON.parse(presStr);
        }
      }

      const blogsStr = localStorage.getItem('blogs');
      if (blogsStr && data.blogs.length === 0) {
        data.blogs = JSON.parse(blogsStr);
      }

      const templatesStr = localStorage.getItem('templates');
      if (templatesStr && data.templates.length === 0) {
        data.templates = JSON.parse(templatesStr);
      }

      const landingPagesStr = localStorage.getItem('landingPages');
      if (landingPagesStr && data.landingPages.length === 0) {
        data.landingPages = JSON.parse(landingPagesStr);
      }

      // Work packages
      const workPackagesStr = localStorage.getItem('workPackages');
      if (workPackagesStr && data.workPackages.length === 0) {
        data.workPackages = JSON.parse(workPackagesStr);
      }

      setLocalStorageData(data);
      setIsScanning(false);
    } catch (err) {
      console.error('Error scanning localStorage:', err);
      setError('Failed to scan localStorage: ' + err.message);
      setIsScanning(false);
    }
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    setError(null);
    setMigrationResults(null);

    try {
      const response = await api.post('/api/migration/localstorage', {
        companyHQ: localStorageData.companyHQ,
        personas: localStorageData.personas,
        contacts: localStorageData.contacts,
        products: localStorageData.products,
        proposals: localStorageData.proposals,
        phaseTemplates: localStorageData.phaseTemplates,
        deliverableTemplates: localStorageData.deliverableTemplates,
        workPackages: localStorageData.workPackages,
        presentations: localStorageData.presentations,
        blogs: localStorageData.blogs,
        templates: localStorageData.templates,
        landingPages: localStorageData.landingPages,
      });

      if (response.data.success) {
        setMigrationResults(response.data.results);
        
        // Update localStorage with new companyHQId if created
        if (response.data.companyHQId) {
          setCompanyHQId(response.data.companyHQId);
          localStorage.setItem('companyHQId', response.data.companyHQId);
          if (localStorageData.companyHQ) {
            // Update companyHQ object in localStorage
            const updatedCompanyHQ = {
              ...localStorageData.companyHQ,
              id: response.data.companyHQId,
            };
            localStorage.setItem('companyHQ', JSON.stringify(updatedCompanyHQ));
          }
        }
      } else {
        setError(response.data.error || 'Migration failed');
      }
    } catch (err) {
      console.error('Migration error:', err);
      setError(err.response?.data?.error || err.message || 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  const getTotalItems = () => {
    return (
      (localStorageData.companyHQ ? 1 : 0) +
      (localStorageData.owner ? 1 : 0) +
      localStorageData.personas.length +
      localStorageData.contacts.length +
      localStorageData.products.length +
      localStorageData.proposals.length +
      localStorageData.phaseTemplates.length +
      localStorageData.deliverableTemplates.length +
      localStorageData.workPackages.length +
      localStorageData.presentations.length +
      localStorageData.blogs.length +
      localStorageData.templates.length +
      localStorageData.landingPages.length
    );
  };

  const getResultsForType = (type) => {
    if (!migrationResults) return null;
    const key = type.toLowerCase().replace(/\s+/g, '');
    return migrationResults[key] || null;
  };

  const DataRow = ({ label, count, type }) => {
    const results = getResultsForType(type || label);
    const created = results?.created || 0;
    const skipped = results?.skipped || 0;
    const errorCount = results?.errors?.length || 0;
    
    return (
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex-1">
          <div className="font-medium">{label}</div>
          {count > 0 && <div className="text-sm text-gray-500">{count} item(s) found</div>}
        </div>
        {results && (
          <div className="text-sm">
            {created > 0 && <span className="text-green-600">✓ {created} created</span>}
            {skipped > 0 && (
              <>
                {' '}
                <span className="text-gray-500">{skipped} skipped</span>
              </>
            )}
            {errorCount > 0 && (
              <>
                {' '}
                <span className="text-red-600">{errorCount} errors</span>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-2">LocalStorage Migration</h1>
          <p className="text-gray-600 mb-6">
            Migrate your data from browser localStorage to the new Neon database
          </p>

          {isScanning ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Scanning localStorage...</p>
            </div>
          ) : (
            <>
              {/* Data Summary */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">Found Data</h2>
                <div className="border rounded-lg overflow-hidden">
                  <DataRow
                    label="Company HQ"
                    type="companyHQ"
                    count={localStorageData.companyHQ ? 1 : 0}
                  />
                  <DataRow
                    label="Owner"
                    count={localStorageData.owner ? 1 : 0}
                  />
                  <DataRow
                    label="Personas"
                    type="personas"
                    count={localStorageData.personas.length}
                  />
                  <DataRow
                    label="Contacts"
                    type="contacts"
                    count={localStorageData.contacts.length}
                  />
                  <DataRow
                    label="Products"
                    type="products"
                    count={localStorageData.products.length}
                  />
                  <DataRow
                    label="Proposals"
                    type="proposals"
                    count={localStorageData.proposals.length}
                  />
                  <DataRow
                    label="Phase Templates"
                    type="phaseTemplates"
                    count={localStorageData.phaseTemplates.length}
                  />
                  <DataRow
                    label="Deliverable Templates"
                    type="deliverableTemplates"
                    count={localStorageData.deliverableTemplates.length}
                  />
                  <DataRow
                    label="Work Packages"
                    type="workPackages"
                    count={localStorageData.workPackages.length}
                  />
                  <DataRow
                    label="Presentations"
                    type="presentations"
                    count={localStorageData.presentations.length}
                  />
                  <DataRow
                    label="Blogs"
                    type="blogs"
                    count={localStorageData.blogs.length}
                  />
                  <DataRow
                    label="Templates"
                    type="templates"
                    count={localStorageData.templates.length}
                  />
                  <DataRow
                    label="Landing Pages"
                    type="landingPages"
                    count={localStorageData.landingPages.length}
                  />
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Total items found:</strong> {getTotalItems()}
                  </p>
                  {getTotalItems() === 0 && (
                    <p className="text-sm text-blue-600 mt-2">
                      No data found in localStorage. If you expected to see data here, make sure you're
                      logged in and have previously used the application.
                    </p>
                  )}
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              )}

              {/* Migration Results */}
              {migrationResults && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium mb-2">Migration Complete!</p>
                  {(companyHQId || migrationResults.companyHQ?.id) && (
                    <p className="text-green-600 text-sm">
                      Company HQ ID: {companyHQId || migrationResults.companyHQ?.id}
                      {migrationResults.companyHQ?.action && (
                        <span className="ml-2">({migrationResults.companyHQ.action})</span>
                      )}
                    </p>
                  )}
                  
                  {/* Show errors if any */}
                  {Object.entries(migrationResults).some(
                    ([key, value]) =>
                      key !== 'companyHQ' &&
                      typeof value === 'object' &&
                      value?.errors?.length > 0
                  ) && (
                    <div className="mt-4">
                      <p className="text-red-800 font-medium text-sm mb-2">Errors encountered:</p>
                      {Object.entries(migrationResults).map(([key, value]) => {
                        if (
                          key === 'companyHQ' ||
                          typeof value !== 'object' ||
                          !value?.errors?.length
                        )
                          return null;
                        return (
                          <div key={key} className="text-sm text-red-600">
                            <strong>{key}:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {value.errors.map((err, idx) => (
                                <li key={idx}>
                                  {typeof err === 'object' 
                                    ? `${Object.values(err)[0]}: ${err.error || JSON.stringify(err)}`
                                    : err
                                  }
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={scanLocalStorage}
                  disabled={isMigrating}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Rescan
                </button>
                <button
                  onClick={handleMigrate}
                  disabled={isMigrating || getTotalItems() === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isMigrating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Migrating...
                    </>
                  ) : (
                    'Migrate to Database'
                  )}
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Proposals and Work Packages have complex relationships
                  (contacts, companies, phases, etc.) and may need to be migrated separately or
                  manually. The migration will attempt to create them, but you may need to link
                  them to their dependencies afterward.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


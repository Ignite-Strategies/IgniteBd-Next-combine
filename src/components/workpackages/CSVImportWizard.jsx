'use client';

import { useState } from 'react';
import { ChevronRight, ChevronLeft, Upload, Map, Eye, CheckCircle } from 'lucide-react';
import CSVFieldMapper from './CSVFieldMapper';
import CSVPreview from './CSVPreview';
import { transformRows, groupIntoPhases, validateMappings } from '@/lib/services/workPackageCsvMapper';

const STEPS = [
  { id: 'upload', label: 'Upload CSV', icon: Upload },
  { id: 'map', label: 'Map Fields', icon: Map },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'create', label: 'Create', icon: CheckCircle },
];

/**
 * CSV Import Wizard Component
 * 4-step wizard for CSV import: Upload → Map → Preview → Create
 */
export default function CSVImportWizard({ 
  csvHeaders, 
  csvRows, 
  onComplete,
  contactId,
  companyId 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mappings, setMappings] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  const step = STEPS[currentStep];
  const validation = mappings && Object.keys(mappings).length > 0 
    ? validateMappings(mappings, csvHeaders) 
    : null;

  const handleNext = () => {
    if (currentStep === 1) {
      // Moving from Map to Preview - transform data
      const transformed = transformRows(csvRows, mappings);
      const grouped = groupIntoPhases(transformed);
      setPreviewData(grouped);
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    if (!previewData) return;
    
    setLoading(true);
    try {
      // Transform rows using mappings
      const transformed = transformRows(csvRows, mappings);
      
      // Call onComplete with transformed data
      if (onComplete) {
        await onComplete({
          workPackage: previewData.workPackage,
          phases: previewData.phases,
          transformedRows: transformed,
          mappings,
        });
      }
    } catch (error) {
      console.error('Error creating work package:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Upload
        return csvHeaders && csvHeaders.length > 0;
      case 1: // Map
        return validation && validation.isValid;
      case 2: // Preview
        return previewData && previewData.phases.length > 0;
      case 3: // Create
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, index) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                index === currentStep
                  ? 'border-red-600 bg-red-50 text-red-600'
                  : index < currentStep
                  ? 'border-green-600 bg-green-50 text-green-600'
                  : 'border-gray-300 bg-white text-gray-400'
              }`}>
                {index < currentStep ? (
                  <CheckCircle className="h-6 w-6" />
                ) : (
                  <s.icon className="h-5 w-5" />
                )}
              </div>
              <span className={`ml-2 text-sm font-medium ${
                index === currentStep
                  ? 'text-red-600'
                  : index < currentStep
                  ? 'text-green-600'
                  : 'text-gray-400'
              }`}>
                {s.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <ChevronRight className="h-5 w-5 text-gray-400 mx-2 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        {currentStep === 0 && (
          <div className="text-center py-8">
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">CSV Uploaded</h3>
            <p className="text-sm text-gray-600">
              {csvHeaders.length} columns, {csvRows.length} rows detected
            </p>
          </div>
        )}

        {currentStep === 1 && (
          <CSVFieldMapper
            csvHeaders={csvHeaders}
            initialMappings={mappings}
            onMappingsChange={setMappings}
          />
        )}

        {currentStep === 2 && previewData && (
          <CSVPreview
            workPackage={previewData.workPackage}
            phases={previewData.phases}
          />
        )}

        {currentStep === 3 && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Create</h3>
            <p className="text-sm text-gray-600">
              Review the preview above, then click "Create Work Package" to proceed
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={!canProceed() || loading}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Work Package'}
          </button>
        )}
      </div>
    </div>
  );
}


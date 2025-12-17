'use client';

import { useState } from 'react';
import { ChevronRight, ChevronLeft, Upload, Map, Eye, CheckCircle, LucideIcon } from 'lucide-react';
import CSVFieldMapper from './CSVFieldMapper';
import CSVPreview from './CSVPreview';
import { transformRows, groupIntoPhases, validateMappings } from '@/lib/services/workPackageCsvMapper';

interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
  phase: number;
}

const STEPS: Step[] = [
  { id: 'upload', label: 'Upload CSV', icon: Upload, phase: 1 },
  { id: 'map', label: 'Map Fields', icon: Map, phase: 1 },
  { id: 'preview', label: 'Preview Data', icon: Eye, phase: 2 },
  { id: 'create', label: 'Confirm & Save', icon: CheckCircle, phase: 2 },
];

interface WorkPackage {
  title?: string;
  description?: string | null;
  totalCost?: number | null;
  effectiveStartDate?: string | null;
}

interface PhaseItem {
  deliverableLabel: string;
  deliverableType: string;
  deliverableDescription?: string | null;
  quantity: number;
  estimatedHoursEach: number;
  unitOfMeasure?: string;
  status?: string;
}

interface Phase {
  name: string;
  position: number;
  description?: string | null;
  items: PhaseItem[];
  totalEstimatedHours?: number;
}

interface PreviewData {
  workPackage: WorkPackage;
  phases: Phase[];
}

interface CSVImportWizardProps {
  csvHeaders: string[];
  csvRows: Record<string, string>[];
  onComplete?: (data: {
    workPackage: WorkPackage;
    phases: Phase[];
    transformedRows: any[];
    mappings: Record<string, string>;
  }) => Promise<void>;
  contactId?: string;
  companyId?: string;
}

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
}: CSVImportWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
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

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: // Upload
        return csvHeaders && csvHeaders.length > 0;
      case 1: // Map
        return validation ? validation.isValid : false;
      case 2: // Preview
        return previewData ? previewData.phases.length > 0 : false;
      case 3: // Create
        return true;
      default:
        return false;
    }
  };

  // Group steps by phase
  const phase1Steps = STEPS.filter(s => s.phase === 1);
  const phase2Steps = STEPS.filter(s => s.phase === 2);
  const currentPhase = STEPS[currentStep]?.phase || 1;

  return (
    <div className="space-y-6">
      {/* Phase Indicators */}
      <div className="space-y-4">
        {/* Phase 1: Match CSV to Fields */}
        <div className={`rounded-lg border-2 p-4 ${
          currentPhase === 1 
            ? 'border-blue-500 bg-blue-50' 
            : currentPhase > 1
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
              currentPhase === 1 
                ? 'bg-blue-600 text-white' 
                : currentPhase > 1
                ? 'bg-green-600 text-white'
                : 'bg-gray-400 text-white'
            }`}>
              {currentPhase > 1 ? '✓' : '1'}
            </div>
            <h3 className={`text-lg font-semibold ${
              currentPhase === 1 ? 'text-blue-900' : currentPhase > 1 ? 'text-green-900' : 'text-gray-600'
            }`}>
              Phase 1: Match CSV Columns to System Fields
            </h3>
          </div>
          <div className="flex items-center gap-2 ml-10">
            {phase1Steps.map((s, index) => {
              const stepIndex = STEPS.findIndex(step => step.id === s.id);
              const isActive = stepIndex === currentStep;
              const isComplete = stepIndex < currentStep;
              return (
                <div key={s.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isActive
                      ? 'border-blue-600 bg-blue-100 text-blue-600'
                      : isComplete
                      ? 'border-green-600 bg-green-100 text-green-600'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <s.icon className="h-4 w-4" />
                    )}
                  </div>
                  {index < phase1Steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase 2: Confirm & Save */}
        <div className={`rounded-lg border-2 p-4 ${
          currentPhase === 2 
            ? 'border-blue-500 bg-blue-50' 
            : currentPhase < 2
            ? 'border-gray-300 bg-gray-50 opacity-50'
            : 'border-green-500 bg-green-50'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
              currentPhase === 2 
                ? 'bg-blue-600 text-white' 
                : currentPhase < 2
                ? 'bg-gray-400 text-white'
                : 'bg-green-600 text-white'
            }`}>
              {currentPhase > 2 ? '✓' : '2'}
            </div>
            <h3 className={`text-lg font-semibold ${
              currentPhase === 2 ? 'text-blue-900' : currentPhase < 2 ? 'text-gray-600' : 'text-green-900'
            }`}>
              Phase 2: Preview Actual Data & Confirm Save
            </h3>
          </div>
          <div className="flex items-center gap-2 ml-10">
            {phase2Steps.map((s, index) => {
              const stepIndex = STEPS.findIndex(step => step.id === s.id);
              const isActive = stepIndex === currentStep;
              const isComplete = stepIndex < currentStep;
              return (
                <div key={s.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isActive
                      ? 'border-blue-600 bg-blue-100 text-blue-600'
                      : isComplete
                      ? 'border-green-600 bg-green-100 text-green-600'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <s.icon className="h-4 w-4" />
                    )}
                  </div>
                  {index < phase2Steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Map className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Phase 1: Match CSV Columns to System Fields
                  </p>
                  <p className="text-sm text-blue-800">
                    Map each CSV column to the corresponding system field. This determines how your data will be transformed.
                  </p>
                </div>
              </div>
            </div>
            <CSVFieldMapper
              csvHeaders={csvHeaders}
              initialMappings={mappings}
              onMappingsChange={setMappings}
            />
          </div>
        )}

        {currentStep === 2 && previewData && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Preview: Actual Transformed Data
                  </p>
                  <p className="text-sm text-blue-800">
                    This preview shows the <strong>actual data</strong> that will be saved to your work package. 
                    Review carefully before proceeding to save.
                  </p>
                </div>
              </div>
            </div>
            <CSVPreview
              workPackage={previewData.workPackage}
              phases={previewData.phases}
            />
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 mb-2">Ready to Save</h3>
                  <p className="text-sm text-green-800 mb-4">
                    You've reviewed the preview above. Click "Confirm & Save Work Package" to create the work package with the data shown.
                  </p>
                  {previewData && (
                    <div className="rounded-lg border border-green-300 bg-white p-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-900">Summary:</p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Work Package: <strong>{previewData.workPackage?.title || 'Untitled'}</strong></li>
                        <li>• Phases: <strong>{previewData.phases?.length || 0}</strong></li>
                        <li>• Total Items: <strong>{previewData.phases?.reduce((sum, p) => sum + (p.items?.length || 0), 0) || 0}</strong></li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Creating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Confirm & Save Work Package
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

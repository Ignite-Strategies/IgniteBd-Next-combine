'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { getAllSystemFields, generateMappings, validateMappings, fuzzyMatchHeader } from '@/lib/services/workPackageCsvMapper';

interface ValidationResult {
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  category: string;
}

interface CSVFieldMapperProps {
  csvHeaders: string[];
  initialMappings?: Record<string, string>;
  onMappingsChange?: (mappings: Record<string, string>) => void;
}

/**
 * CSV Field Mapper Component
 * Allows users to map CSV columns to system fields
 */
export default function CSVFieldMapper({ csvHeaders, initialMappings, onMappingsChange }: CSVFieldMapperProps) {
  const [mappings, setMappings] = useState<Record<string, string>>(initialMappings || {});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const hasGeneratedMappings = useRef(false);
  
  const systemFields = getAllSystemFields() as SystemField[];

  // Sync with initialMappings prop when it changes (but only if it has values)
  useEffect(() => {
    if (initialMappings && Object.keys(initialMappings).length > 0) {
      setMappings(initialMappings);
      hasGeneratedMappings.current = true;
    }
  }, [initialMappings]);

  // Hardcoded mappings for common CSV column names - EXACT MATCHES
  const getHardcodedMapping = (csvHeader: string): string | null => {
    // Remove quotes and normalize
    const cleaned = csvHeader.replace(/^["']|["']$/g, '').trim();
    const normalized = cleaned.toLowerCase();
    
    // Direct mappings based on exact CSV column names from the template
    const hardcodedMappings: Record<string, string> = {
      // Work Package fields
      'proposaltitle': 'title',
      'proposal_title': 'title',
      'proposal-title': 'title',
      'workpackagetitle': 'title',
      'work_package_title': 'title',
      
      'proposaldescription': 'description',
      'proposal_description': 'description',
      'proposal-description': 'description',
      'workpackagedescription': 'description',
      'work_package_description': 'description',
      'proposalnotes': 'description',
      'proposal_notes': 'description',
      'proposal-notes': 'description',
      
      'proposaltotalcost': 'totalCost',
      'proposal_total_cost': 'totalCost',
      'proposal-total-cost': 'totalCost',
      'totalcost': 'totalCost',
      'total_cost': 'totalCost',
      'cost': 'totalCost',
      
      'effectivestartdate': 'effectiveStartDate',
      'effective_start_date': 'effectiveStartDate',
      'startdate': 'effectiveStartDate',
      'start_date': 'effectiveStartDate',
      
      // Phase fields
      'phasename': 'name',
      'phase_name': 'name',
      'phase-name': 'name',
      'phase': 'name',
      
      'phaseposition': 'position',
      'phase_position': 'position',
      'phase-position': 'position',
      'position': 'position',
      
      'phasedescription': 'phaseDescription',
      'phase_description': 'phaseDescription',
      'phase-description': 'phaseDescription',
      
      // Item/Deliverable fields
      'deliverablelabel': 'deliverableLabel',
      'deliverable_label': 'deliverableLabel',
      'deliverable-label': 'deliverableLabel',
      'deliverablename': 'deliverableLabel',
      'itemlabel': 'deliverableLabel',
      'item_label': 'deliverableLabel',
      'itemname': 'deliverableLabel',
      'item_name': 'deliverableLabel',
      
      'deliverabletype': 'deliverableType',
      'deliverable_type': 'deliverableType',
      'deliverable-type': 'deliverableType',
      'itemtype': 'deliverableType',
      'item_type': 'deliverableType',
      
      'deliverabledescription': 'deliverableDescription',
      'deliverable_description': 'deliverableDescription',
      'deliverable-description': 'deliverableDescription',
      'itemdescription': 'deliverableDescription',
      'item_description': 'deliverableDescription',
      
      'quantity': 'quantity',
      'qty': 'quantity',
      'amount': 'quantity',
      
      'estimatedhourseach': 'estimatedHoursEach',
      'estimated_hours_each': 'estimatedHoursEach',
      'estimated-hours-each': 'estimatedHoursEach',
      'hours': 'estimatedHoursEach',
      'hourseach': 'estimatedHoursEach',
      
      'unitofmeasure': 'unitOfMeasure',
      'unit_of_measure': 'unitOfMeasure',
      'unit-of-measure': 'unitOfMeasure',
      'unit': 'unitOfMeasure',
      'uom': 'unitOfMeasure',
      
      'status': 'status',
    };
    
    // Check exact match first
    if (hardcodedMappings[normalized]) {
      return hardcodedMappings[normalized];
    }
    
    // Check normalized (remove dashes, underscores, spaces)
    const normalizedKey = normalized.replace(/[-_\s]/g, '');
    if (hardcodedMappings[normalizedKey]) {
      return hardcodedMappings[normalizedKey];
    }
    
    return null;
  };

  useEffect(() => {
    // Auto-generate mappings when we have headers and haven't generated yet
    // Check if mappings are empty or if any header is missing a mapping
    const isEmpty = Object.keys(mappings).length === 0;
    const hasUnmappedHeaders = csvHeaders.some(header => !mappings[header] || mappings[header] === 'unmapped');
    
    if (csvHeaders.length > 0 && !hasGeneratedMappings.current && (isEmpty || hasUnmappedHeaders)) {
      // Use the existing fuzzyMatchHeader function from workPackageCsvMapper
      const autoMappings: Record<string, string> = { ...mappings };
      
      csvHeaders.forEach((header) => {
        // Only generate mapping if not already set or if it's unmapped
        if (!autoMappings[header] || autoMappings[header] === 'unmapped') {
          // Use the existing mapper's fuzzyMatchHeader function directly
          const matched = fuzzyMatchHeader(header);
          autoMappings[header] = matched || 'unmapped';
          console.log(`🔍 Mapped "${header}" → "${matched || 'unmapped'}"`);
        }
      });
      
      console.log('✅ Final auto-generated mappings:', autoMappings);
      hasGeneratedMappings.current = true;
      setMappings(autoMappings);
      if (onMappingsChange) {
        onMappingsChange(autoMappings);
      }
    }
  }, [csvHeaders, mappings, onMappingsChange]);

  useEffect(() => {
    if (Object.keys(mappings).length > 0) {
      const validationResult = validateMappings(mappings, csvHeaders);
      setValidation(validationResult);
      if (onMappingsChange) {
        onMappingsChange(mappings);
      }
    }
  }, [mappings, csvHeaders, onMappingsChange]);

  const handleMappingChange = (csvHeader: string, systemField: string) => {
    setMappings(prev => ({
      ...prev,
      [csvHeader]: systemField,
    }));
  };

  const getFieldCategory = (systemFieldKey: string): string => {
    const field = systemFields.find(f => f.key === systemFieldKey);
    return field?.category || 'other';
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'workPackage':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'phase':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'item':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Validation Summary */}
      {validation && (
        <div className={`rounded-lg border p-4 ${
          validation.isValid 
            ? 'border-green-200 bg-green-50' 
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-start gap-3">
            {validation.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                validation.isValid ? 'text-green-800' : 'text-red-800'
              }`}>
                {validation.isValid 
                  ? 'All required fields are mapped'
                  : 'Please fix mapping errors'
                }
              </p>
              {validation.errors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 space-y-1">
                  {validation.errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              )}
              {validation.warnings.length > 0 && (
                <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                  {validation.warnings.map((warning, idx) => (
                    <li key={idx}>
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mapping Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Map CSV Columns to System Fields</h3>
          <p className="text-sm text-gray-600 mt-1">
            Match each CSV column to the corresponding system field
          </p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {csvHeaders.map((csvHeader) => {
            const mappedField = mappings[csvHeader] || 'unmapped';
            const field = systemFields.find(f => f.key === mappedField);
            const category = field?.category || 'ignore';
            
            return (
              <div key={csvHeader} className="px-6 py-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      CSV Column: <span className="font-mono text-gray-600">"{csvHeader}"</span>
                    </label>
                    <select
                      value={mappedField}
                      onChange={(e) => handleMappingChange(csvHeader, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    >
                      <optgroup label="Work Package">
                        {systemFields.filter(f => f.category === 'workPackage').map(field => (
                          <option key={field.key} value={field.key}>
                            {field.label} {field.required && '*'}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Phase">
                        {systemFields.filter(f => f.category === 'phase').map(field => (
                          <option key={field.key} value={field.key}>
                            {field.label} {field.required && '*'}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Item">
                        {systemFields.filter(f => f.category === 'item').map(field => (
                          <option key={field.key} value={field.key}>
                            {field.label} {field.required && '*'}
                          </option>
                        ))}
                      </optgroup>
                      <option value="unmapped">Ignore Column</option>
                    </select>
                  </div>
                  <div className="w-48">
                    {mappedField !== 'unmapped' && (
                      <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${getCategoryColor(category)}`}>
                        {field?.label || mappedField}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-700 mb-2">Field Categories:</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500"></span>
            Work Package (global)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-purple-500"></span>
            Phase
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500"></span>
            Item
          </span>
          <span className="text-gray-500 ml-2">* = Required field</span>
        </div>
      </div>
    </div>
  );
}

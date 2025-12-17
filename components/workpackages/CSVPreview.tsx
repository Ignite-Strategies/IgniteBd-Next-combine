'use client';

import { Package } from 'lucide-react';
import { getItemTypeLabel } from '@/lib/config/workPackageConfig';

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

interface CSVPreviewProps {
  workPackage: WorkPackage;
  phases: Phase[];
}

/**
 * CSV Preview Component
 * Shows fully-hydrated WorkPackage preview using same UI as production
 */
export default function CSVPreview({ workPackage, phases }: CSVPreviewProps) {
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status?: string): string => {
    switch (status) {
      case 'completed':
        return 'Complete';
      case 'in_progress':
        return 'In Progress';
      case 'not_started':
        return 'Not Started';
      default:
        return status || 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Work Package Overview */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {workPackage.title || 'Work Package'}
        </h2>
        {workPackage.description && (
          <p className="text-gray-600">{workPackage.description}</p>
        )}
        {workPackage.totalCost && (
          <p className="mt-2 text-lg font-semibold text-gray-900">
            Total Cost: ${workPackage.totalCost.toLocaleString()}
          </p>
        )}
      </div>

      {/* Phases */}
      {phases && phases.length > 0 ? (
        <div className="space-y-6">
          {phases.map((phase, phaseIndex) => (
            <div key={phaseIndex} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{phase.name}</h2>
                  {phase.description && (
                    <p className="mt-1 text-sm text-gray-600">{phase.description}</p>
                  )}
                  {phase.totalEstimatedHours && (
                    <p className="mt-1 text-xs text-gray-500">
                      Estimated Hours: {phase.totalEstimatedHours}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  Position {phase.position}
                </span>
              </div>

              {/* Items in Phase */}
              {phase.items && phase.items.length > 0 ? (
                <div className="space-y-3">
                  {phase.items.map((item, itemIndex) => {
                    const totalHours = item.quantity * item.estimatedHoursEach;
                    return (
                      <div
                        key={itemIndex}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="font-semibold text-gray-900">
                                {item.deliverableLabel}
                              </h3>
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                {getItemTypeLabel(item.deliverableType)}
                              </span>
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                              </span>
                            </div>
                            
                            {item.deliverableDescription && (
                              <p className="mt-2 text-sm text-gray-600">
                                {item.deliverableDescription}
                              </p>
                            )}
                            
                            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                              <span>Quantity: <strong className="text-gray-900">{item.quantity}</strong></span>
                              <span>Hours Each: <strong className="text-gray-900">{item.estimatedHoursEach}</strong></span>
                              <span>Total Hours: <strong className="text-gray-900">{totalHours}</strong></span>
                              {item.unitOfMeasure && (
                                <span>Unit: <strong className="text-gray-900">{item.unitOfMeasure}</strong></span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No items in this phase</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-semibold text-gray-800">No phases found</p>
          <p className="mt-2 text-sm text-gray-500">
            Make sure phase fields are properly mapped
          </p>
        </div>
      )}
    </div>
  );
}

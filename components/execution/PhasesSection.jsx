'use client';

import PhaseCard from './PhaseCard';

export default function PhasesSection({ phases, workPackageId, onPhaseUpdate, onItemStatusUpdate }) {
  if (!phases || phases.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow">
        <p className="text-sm text-gray-500">No phases found in this work package</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phases.map((phase) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          workPackageId={workPackageId}
          onPhaseUpdate={onPhaseUpdate}
          onItemStatusUpdate={onItemStatusUpdate}
        />
      ))}
    </div>
  );
}


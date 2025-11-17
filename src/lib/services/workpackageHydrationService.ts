/**
 * Work Package Hydration Service
 * Handles CSV import, upsert logic, and calculations
 */

import { prisma } from '@/lib/prisma';
import type { WorkPackageCSVRow } from '@/lib/utils/csv';

export interface HydrationResult {
  workPackageId: string;
  phasesCreated: number;
  phasesUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  totalEstimatedHours: number;
}

/**
 * Create or update WorkPackage from CSV data
 * Note: For CSV imports, we always create new work packages (no upsert)
 * Use createWorkPackage instead for CSV imports
 */
export async function upsertWorkPackage(params: {
  workPackageId: string;
  title?: string;
  description?: string;
  totalCost?: number;
  effectiveStartDate?: Date;
}): Promise<string> {
  const { workPackageId, title, description, totalCost, effectiveStartDate } = params;

  const workPackage = await prisma.workPackage.update({
    where: { id: workPackageId },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(totalCost !== undefined && { totalCost }),
      ...(effectiveStartDate && { effectiveStartDate }),
      updatedAt: new Date(),
    },
  });

  return workPackage.id;
}

/**
 * Create WorkPackage (no upsert - always create new)
 */
export async function createWorkPackage(params: {
  contactId: string;
  companyId?: string;
  title: string;
  description?: string;
  totalCost?: number;
  effectiveStartDate?: Date;
}): Promise<string> {
  const { contactId, companyId, title, description, totalCost, effectiveStartDate } = params;

  const workPackage = await prisma.workPackage.create({
    data: {
      contactId,
      companyId: companyId || null,
      title,
      description,
      totalCost,
      effectiveStartDate,
    },
  });

  return workPackage.id;
}

/**
 * Upsert WorkPackagePhase (idempotent by workPackageId + name + position)
 */
export async function upsertPhase(params: {
  workPackageId: string;
  name: string;
  position: number;
  description?: string;
}): Promise<string> {
  const { workPackageId, name, position, description } = params;

  // Check if phase exists
  const existing = await prisma.workPackagePhase.findFirst({
    where: {
      workPackageId,
      name,
      position,
    },
  });

  if (existing) {
    // Update existing
    const updated = await prisma.workPackagePhase.update({
      where: { id: existing.id },
      data: {
        description,
        updatedAt: new Date(),
      },
    });
    return updated.id;
  }

  // Create new
  const created = await prisma.workPackagePhase.create({
    data: {
      workPackageId,
      name,
      position,
      description,
    },
  });

  return created.id;
}

/**
 * Upsert WorkPackageItem (idempotent by workPackageId + phaseId + deliverableLabel)
 */
export async function upsertItem(params: {
  workPackageId: string;
  workPackagePhaseId: string;
  deliverableType: string;
  deliverableLabel: string;
  deliverableDescription?: string;
  quantity: number;
  unitOfMeasure: string;
  estimatedHoursEach: number;
  status: string;
}): Promise<string> {
  const {
    workPackageId,
    workPackagePhaseId,
    deliverableType,
    deliverableLabel,
    deliverableDescription,
    quantity,
    unitOfMeasure,
    estimatedHoursEach,
    status,
  } = params;

  // Check if item exists
  const existing = await prisma.workPackageItem.findFirst({
    where: {
      workPackageId,
      workPackagePhaseId,
      deliverableLabel,
    },
  });

  // Sync legacy fields
  const itemType = deliverableType;
  const itemLabel = deliverableLabel;
  const itemDescription = deliverableDescription;

  const data = {
    workPackageId,
    workPackagePhaseId,
    deliverableType,
    deliverableLabel,
    deliverableDescription,
    itemType, // Sync to legacy field
    itemLabel, // Sync to legacy field
    itemDescription, // Sync to legacy field
    quantity,
    unitOfMeasure,
    estimatedHoursEach,
    status,
  };

  if (existing) {
    // Update existing
    const updated = await prisma.workPackageItem.update({
      where: { id: existing.id },
      data,
    });
    return updated.id;
  }

  // Create new
  const created = await prisma.workPackageItem.create({
    data,
  });

  return created.id;
}

/**
 * Calculate total estimated hours for a phase
 */
export async function calculatePhaseHours(phaseId: string): Promise<number> {
  const items = await prisma.workPackageItem.findMany({
    where: { workPackagePhaseId: phaseId },
  });

  return items.reduce((total, item) => {
    return total + (item.quantity * item.estimatedHoursEach);
  }, 0);
}

/**
 * Calculate total estimated hours for a work package
 */
export async function calculatePackageHours(workPackageId: string): Promise<number> {
  const items = await prisma.workPackageItem.findMany({
    where: { workPackageId },
  });

  return items.reduce((total, item) => {
    return total + (item.quantity * item.estimatedHoursEach);
  }, 0);
}

/**
 * Update phase totalEstimatedHours
 */
export async function updatePhaseTotalHours(phaseId: string): Promise<void> {
  const totalHours = await calculatePhaseHours(phaseId);
  
  await prisma.workPackagePhase.update({
    where: { id: phaseId },
    data: { totalEstimatedHours: totalHours },
  });
}

/**
 * Full hydration from CSV rows
 */
export async function hydrateWorkPackageFromCSV(params: {
  contactId: string;
  companyId?: string;
  title: string;
  rows: WorkPackageCSVRow[];
}): Promise<HydrationResult> {
  const { contactId, companyId, title, rows } = params;

  if (rows.length === 0) {
    throw new Error('No rows provided for hydration');
  }

  // Extract proposal metadata from first row
  const proposalMetadata = rows[0];
  const description = proposalMetadata.proposalDescription;
  const totalCost = proposalMetadata.proposalTotalCost;

  // Create WorkPackage
  const workPackageId = await createWorkPackage({
    contactId,
    companyId,
    title,
    description,
    totalCost,
  });

  // Track created/updated counts
  let phasesCreated = 0;
  let phasesUpdated = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  const phaseMap = new Map<string, string>(); // phaseKey -> phaseId

  // Process each row
  for (const row of rows) {
    // Upsert phase
    const phaseKey = `${row.phaseName}-${row.phasePosition}`;
    let phaseId = phaseMap.get(phaseKey);

    if (!phaseId) {
      const existingPhase = await prisma.workPackagePhase.findFirst({
        where: {
          workPackageId,
          name: row.phaseName,
          position: row.phasePosition,
        },
      });

      if (existingPhase) {
        phaseId = existingPhase.id;
        phasesUpdated++;
      } else {
        phaseId = await upsertPhase({
          workPackageId,
          name: row.phaseName,
          position: row.phasePosition,
          description: row.phaseDescription,
        });
        phasesCreated++;
      }
      phaseMap.set(phaseKey, phaseId);
    }

    // Upsert item
    const existingItem = await prisma.workPackageItem.findFirst({
      where: {
        workPackageId,
        workPackagePhaseId: phaseId,
        deliverableLabel: row.deliverableLabel,
      },
    });

    if (existingItem) {
      await upsertItem({
        workPackageId,
        workPackagePhaseId: phaseId,
        deliverableType: row.deliverableType,
        deliverableLabel: row.deliverableLabel,
        deliverableDescription: row.deliverableDescription,
        quantity: row.quantity,
        unitOfMeasure: row.unitOfMeasure,
        estimatedHoursEach: row.estimatedHoursEach,
        status: row.status,
      });
      itemsUpdated++;
    } else {
      await upsertItem({
        workPackageId,
        workPackagePhaseId: phaseId,
        deliverableType: row.deliverableType,
        deliverableLabel: row.deliverableLabel,
        deliverableDescription: row.deliverableDescription,
        quantity: row.quantity,
        unitOfMeasure: row.unitOfMeasure,
        estimatedHoursEach: row.estimatedHoursEach,
        status: row.status,
      });
      itemsCreated++;
    }

    // Update phase total hours
    await updatePhaseTotalHours(phaseId);
  }

  // Calculate total hours
  const totalEstimatedHours = await calculatePackageHours(workPackageId);

  return {
    workPackageId,
    phasesCreated,
    phasesUpdated,
    itemsCreated,
    itemsUpdated,
    totalEstimatedHours,
  };
}


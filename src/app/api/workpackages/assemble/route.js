import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculatePhaseTotalDuration, normalizeDuration } from '@/lib/services/DurationNormalizationService';

/**
 * POST /api/workpackages/assemble
 * Assemble WorkPackage from templates
 * Supports: templates, CSV, clone, blank
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { contactId, assemblyType, data } = body;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    let phasesData = [];

    // Handle different assembly types
    switch (assemblyType) {
      case 'templates': {
        // data: { phases: [{ phaseTemplateId, position, deliverables: [...] }] }
        const phaseTemplates = await prisma.phaseTemplate.findMany({
          where: { id: { in: data.phases.map(p => p.phaseTemplateId) } },
        });

        const deliverableTemplates = await prisma.deliverableTemplate.findMany();

        phasesData = data.phases.map((phaseData) => {
          const phaseTemplate = phaseTemplates.find(pt => pt.id === phaseData.phaseTemplateId);
          const phaseItems = phaseData.deliverables.map((deliverableData) => {
            const deliverableTemplate = deliverableTemplates.find(
              dt => dt.deliverableType === deliverableData.deliverableType
            );
            
            return {
              itemType: deliverableTemplate?.deliverableType || deliverableData.deliverableType,
              itemLabel: deliverableTemplate?.deliverableLabel || deliverableData.itemLabel,
              itemDescription: deliverableData.itemDescription || null,
              quantity: deliverableData.quantity || 1,
              unitOfMeasure: deliverableData.unitOfMeasure || deliverableTemplate?.defaultUnitOfMeasure || 'day',
              duration: deliverableData.duration || deliverableTemplate?.defaultDuration || 1,
              status: 'todo',
            };
          });

          return {
            name: phaseTemplate?.name || 'Unnamed Phase',
            position: phaseData.position,
            items: phaseItems,
          };
        });
        break;
      }

      case 'csv': {
        // data: { rows: [{ phaseName, deliverableType, quantity, duration?, unitOfMeasure? }] }
        const deliverableTemplates = await prisma.deliverableTemplate.findMany();
        const phaseMap = new Map();
        const itemsByPhase = new Map();

        data.rows.forEach((row, index) => {
          const phaseName = row.phaseName?.trim() || 'Unnamed Phase';
          const position = parseInt(row.position) || index + 1;

          if (!phaseMap.has(phaseName)) {
            phaseMap.set(phaseName, {
              name: phaseName,
              position: position,
            });
            itemsByPhase.set(phaseName, []);
          }

          const deliverableTemplate = deliverableTemplates.find(
            dt => dt.deliverableType === row.deliverableType
          );

          itemsByPhase.get(phaseName).push({
            itemType: row.deliverableType || deliverableTemplate?.deliverableType || 'blog',
            itemLabel: row.itemLabel || deliverableTemplate?.deliverableLabel || 'Untitled Item',
            itemDescription: row.itemDescription || null,
            quantity: parseInt(row.quantity) || 1,
            unitOfMeasure: row.unitOfMeasure || deliverableTemplate?.defaultUnitOfMeasure || 'day',
            duration: parseInt(row.duration) || deliverableTemplate?.defaultDuration || 1,
            status: 'todo',
          });
        });

        phasesData = Array.from(phaseMap.values()).sort((a, b) => a.position - b.position).map(phase => ({
          name: phase.name,
          position: phase.position,
          items: itemsByPhase.get(phase.name),
        }));
        break;
      }

      case 'clone': {
        // data: { sourceWorkPackageId }
        const sourceWorkPackage = await prisma.workPackage.findUnique({
          where: { id: data.sourceWorkPackageId },
          include: {
            phases: {
              include: {
                items: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        });

        if (!sourceWorkPackage) {
          return NextResponse.json(
            { success: false, error: 'Source work package not found' },
            { status: 404 },
          );
        }

        phasesData = sourceWorkPackage.phases.map((phase) => ({
          name: phase.name,
          position: phase.position,
          items: phase.items.map((item) => ({
            itemType: item.itemType,
            itemLabel: item.itemLabel,
            itemDescription: item.itemDescription,
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure,
            duration: item.duration,
            status: 'todo',
          })),
        }));
        break;
      }

      case 'blank': {
        // data: { phases: [{ name, position, items: [...] }] }
        phasesData = data.phases.map((phase) => ({
          name: phase.name,
          position: phase.position,
          items: phase.items.map((item) => ({
            itemType: item.itemType,
            itemLabel: item.itemLabel,
            itemDescription: item.itemDescription || null,
            quantity: item.quantity || 1,
            unitOfMeasure: item.unitOfMeasure || 'day',
            duration: item.duration || 1,
            status: 'todo',
          })),
        }));
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid assembly type' },
          { status: 400 },
        );
    }

    // Calculate phase total durations and create work package
    const phasesWithDurations = phasesData.map((phase) => {
      const phaseTotalDuration = calculatePhaseTotalDuration(phase.items);
      return {
        ...phase,
        phaseTotalDuration,
      };
    });

    // Create WorkPackage
    const workPackage = await prisma.workPackage.create({
      data: {
        contactId,
        phases: {
          create: phasesWithDurations.map((phase) => ({
            name: phase.name,
            position: phase.position,
            phaseTotalDuration: phase.phaseTotalDuration,
            items: {
              create: phase.items.map((item) => ({
                itemType: item.itemType,
                itemLabel: item.itemLabel,
                itemDescription: item.itemDescription,
                quantity: item.quantity,
                unitOfMeasure: item.unitOfMeasure,
                duration: item.duration,
                status: item.status,
              })),
            },
          })),
        },
      },
      include: {
        phases: {
          include: {
            items: true,
          },
          orderBy: { position: 'asc' },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      workPackage,
    });
  } catch (error) {
    console.error('❌ AssembleWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to assemble work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}


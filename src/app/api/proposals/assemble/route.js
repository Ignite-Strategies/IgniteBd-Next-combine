import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/proposals/assemble
 * Assemble Proposal from templates
 * Creates Proposal with ProposalPhase and ProposalDeliverable instances from templates
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
    const { 
      contactId, 
      companyHQId,
      companyId,
      title,
      estimatedStart,
      purpose,
      totalPrice,
      assemblyType, 
      data 
    } = body;

    if (!contactId || !companyHQId || !companyId || !title || !estimatedStart) {
      return NextResponse.json(
        { success: false, error: 'contactId, companyHQId, companyId, title, and estimatedStart are required' },
        { status: 400 },
      );
    }

    // Verify contact and company exist
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    let proposalPhases = [];
    let proposalDeliverables = []; // Detached copies at proposal level

    // Handle different assembly types
    switch (assemblyType) {
      case 'templates': {
        // data: { phases: [{ phaseTemplateId, position, deliverables: [...] }] }
        const phaseTemplates = await prisma.phaseTemplate.findMany({
          where: {
            id: { in: data.phases.map(p => p.phaseTemplateId) },
            companyHQId,
          },
        });

        const deliverableTemplates = await prisma.deliverableTemplate.findMany({
          where: { companyHQId },
        });

        proposalPhases = data.phases.map((phaseData) => {
          const phaseTemplate = phaseTemplates.find(pt => pt.id === phaseData.phaseTemplateId);
          
          // Calculate phase duration from deliverables
          const phaseDeliverables = phaseData.deliverables.map((deliverableData) => {
            const deliverableTemplate = deliverableTemplates.find(
              dt => dt.deliverableType === deliverableData.deliverableType || dt.id === deliverableData.deliverableTemplateId
            );
            
            // Calculate durationWeeks from duration and unitOfMeasure
            const duration = deliverableData.duration || deliverableTemplate?.defaultDuration || 1;
            const unitOfMeasure = deliverableData.unitOfMeasure || deliverableTemplate?.defaultUnitOfMeasure || 'week';
            let durationWeeks = duration;
            if (unitOfMeasure === 'day') {
              durationWeeks = Math.ceil(duration / 5); // Convert business days to weeks
            } else if (unitOfMeasure === 'month') {
              durationWeeks = duration * 4; // Approximate months to weeks
            }
            
            return {
              durationWeeks,
              deliverableTemplate, // Keep for hydration
              deliverableData, // Keep for hydration
            };
          });

          // Phase duration is max of deliverable durations
          const maxDurationWeeks = Math.max(...phaseDeliverables.map(d => d.durationWeeks || 3), 3);

          // Hydrate detached ProposalDeliverable copies (no template links)
          phaseDeliverables.forEach(({ deliverableTemplate, deliverableData }) => {
            const quantity = deliverableData.quantity || 1;
            const unitPrice = deliverableData.unitPrice || null;
            const totalPrice = unitPrice ? unitPrice * quantity : null;
            
            proposalDeliverables.push({
              name: deliverableData.itemLabel || deliverableTemplate?.deliverableLabel || 'Untitled Deliverable',
              description: deliverableData.itemDescription || deliverableTemplate?.description || null,
              quantity,
              unitPrice,
              totalPrice,
              notes: deliverableData.notes || null,
            });
          });

          return {
            phaseTemplateId: phaseTemplate?.id || null,
            name: phaseTemplate?.name || phaseData.name || 'Unnamed Phase',
            description: phaseTemplate?.description || null,
            durationWeeks: phaseData.durationWeeks || maxDurationWeeks,
            order: phaseData.position,
          };
        });
        break;
      }

      case 'csv': {
        // data: { rows: [{ phaseName, deliverableType, quantity, duration?, unitOfMeasure? }] }
        const deliverableTemplates = await prisma.deliverableTemplate.findMany({
          where: { companyHQId },
        });
        const phaseMap = new Map();
        const deliverablesByPhase = new Map();

        data.rows.forEach((row, index) => {
          const phaseName = row.phaseName?.trim() || 'Unnamed Phase';
          const position = parseInt(row.position) || index + 1;

          if (!phaseMap.has(phaseName)) {
            phaseMap.set(phaseName, {
              name: phaseName,
              position: position,
            });
            deliverablesByPhase.set(phaseName, []);
          }

          const deliverableTemplate = deliverableTemplates.find(
            dt => dt.deliverableType === row.deliverableType
          );

          const duration = parseInt(row.duration) || deliverableTemplate?.defaultDuration || 1;
          const unitOfMeasure = row.unitOfMeasure || deliverableTemplate?.defaultUnitOfMeasure || 'week';
          let durationWeeks = duration;
          if (unitOfMeasure === 'day') {
            durationWeeks = Math.ceil(duration / 5);
          } else if (unitOfMeasure === 'month') {
            durationWeeks = duration * 4;
          }

          deliverablesByPhase.get(phaseName).push({
            durationWeeks,
            deliverableTemplate,
            row,
          });

          // Hydrate detached ProposalDeliverable copy
          const quantity = parseInt(row.quantity) || 1;
          const unitPrice = parseFloat(row.unitPrice) || null;
          const totalPrice = unitPrice ? unitPrice * quantity : null;
          
          proposalDeliverables.push({
            name: row.itemLabel || deliverableTemplate?.deliverableLabel || 'Untitled Deliverable',
            description: row.itemDescription || null,
            quantity,
            unitPrice,
            totalPrice,
            notes: row.notes || null,
          });
        });

        proposalPhases = Array.from(phaseMap.values()).sort((a, b) => a.position - b.position).map((phase) => {
          const phaseDeliverables = deliverablesByPhase.get(phase.name);
          const maxDurationWeeks = phaseDeliverables.length > 0 
            ? Math.max(...phaseDeliverables.map(d => d.durationWeeks || 3), 3) 
            : 3;
          
          return {
            phaseTemplateId: null,
            name: phase.name,
            description: null,
            durationWeeks: maxDurationWeeks,
            order: phase.position,
          };
        });
        break;
      }

      case 'clone': {
        // data: { sourceProposalId }
        const sourceProposal = await prisma.proposal.findUnique({
          where: { id: data.sourceProposalId },
          include: {
            proposalPhases: {
              orderBy: { order: 'asc' },
            },
            proposalDeliverables: true, // Get detached deliverables
          },
        });

        if (!sourceProposal) {
          return NextResponse.json(
            { success: false, error: 'Source proposal not found' },
            { status: 404 },
          );
        }

        proposalPhases = sourceProposal.proposalPhases.map((phase) => ({
          phaseTemplateId: phase.phaseTemplateId,
          name: phase.name,
          description: phase.description,
          durationWeeks: phase.durationWeeks,
          order: phase.order,
        }));

        // Clone detached deliverables (no template links)
        proposalDeliverables = sourceProposal.proposalDeliverables.map((deliverable) => ({
          name: deliverable.name,
          description: deliverable.description,
          quantity: deliverable.quantity,
          unitPrice: deliverable.unitPrice,
          totalPrice: deliverable.totalPrice,
          notes: deliverable.notes,
        }));
        break;
      }

      case 'blank': {
        // data: { phases: [{ name, position, durationWeeks }], deliverables: [...] }
        proposalPhases = data.phases.map((phase) => ({
          phaseTemplateId: null,
          name: phase.name,
          description: phase.description || null,
          durationWeeks: phase.durationWeeks || 3,
          order: phase.position,
        }));

        // Create detached deliverables from data.deliverables
        if (data.deliverables && Array.isArray(data.deliverables)) {
          proposalDeliverables = data.deliverables.map((deliverable) => {
            const quantity = deliverable.quantity || 1;
            const unitPrice = deliverable.unitPrice || null;
            const totalPrice = unitPrice ? unitPrice * quantity : (deliverable.totalPrice || null);
            
            return {
              name: deliverable.name || 'Untitled Deliverable',
              description: deliverable.description || null,
              quantity,
              unitPrice,
              totalPrice,
              notes: deliverable.notes || null,
            };
          });
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid assembly type' },
          { status: 400 },
        );
    }

    // Calculate totalPrice from deliverables if not provided
    const calculatedTotalPrice = proposalDeliverables.reduce((sum, d) => {
      return sum + (d.totalPrice || (d.unitPrice ? d.unitPrice * d.quantity : 0));
    }, 0);
    const finalTotalPrice = totalPrice || (calculatedTotalPrice > 0 ? calculatedTotalPrice : null);

    // Create Proposal with ProposalPhase (timeline) and ProposalDeliverable (detached line items)
    const proposal = await prisma.proposal.create({
      data: {
        companyHQId,
        title,
        contactId,
        companyId,
        estimatedStart: new Date(estimatedStart),
        purpose: purpose || null,
        status: 'draft',
        totalPrice: finalTotalPrice,
        dateIssued: new Date(),
        proposalPhases: {
          create: proposalPhases.map((phase) => ({
            phaseTemplateId: phase.phaseTemplateId || null,
            name: phase.name,
            description: phase.description || null,
            durationWeeks: phase.durationWeeks || 3,
            order: phase.order,
          })),
        },
        proposalDeliverables: {
          create: proposalDeliverables.map((deliverable) => ({
            name: deliverable.name,
            description: deliverable.description || null,
            quantity: deliverable.quantity,
            unitPrice: deliverable.unitPrice,
            totalPrice: deliverable.totalPrice || (deliverable.unitPrice ? deliverable.unitPrice * deliverable.quantity : null),
            notes: deliverable.notes || null,
          })),
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposalPhases: {
          include: {
            phaseTemplate: true,
          },
          orderBy: { order: 'asc' },
        },
        proposalDeliverables: true, // Detached line items (no template links)
      },
    });

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ AssembleProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to assemble proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}


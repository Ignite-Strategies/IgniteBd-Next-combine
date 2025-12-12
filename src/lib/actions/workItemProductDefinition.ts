'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { workItemProductDefinitionSchema, type WorkItemProductDefinitionFormData } from '@/lib/schemas/workItemProductDefinitionSchema';
import { revalidatePath } from 'next/cache';

/**
 * Save WorkItem Product Definition to WorkCollateral
 * Creates or updates WorkCollateral with type "PRODUCT_DEFINITION"
 */
export async function saveWorkItemProductDefinition(
  workPackageItemId: string,
  data: WorkItemProductDefinitionFormData
) {
  try {
    // Validate input
    const validated = workItemProductDefinitionSchema.parse(data);

    // Verify WorkPackageItem exists
    const item = await prisma.workPackageItem.findUnique({
      where: { id: workPackageItemId },
    });

    if (!item) {
      return {
        success: false,
        error: 'WorkPackageItem not found',
      };
    }

    // Check if WorkCollateral already exists for this item
    const existingCollateral = await prisma.workCollateral.findFirst({
      where: {
        workPackageItemId,
        type: 'PRODUCT_DEFINITION',
      },
    });

    const contentJson = {
      name: validated.name,
      category: validated.category || null,
      valueProp: validated.valueProp || null,
      description: validated.description || null,
      price: validated.price || null,
      priceCurrency: validated.priceCurrency || null,
      pricingModel: validated.pricingModel || null,
      targetedTo: validated.targetedTo || null,
      targetMarketSize: validated.targetMarketSize || null,
      salesCycleLength: validated.salesCycleLength || null,
      deliveryTimeline: validated.deliveryTimeline || null,
      features: validated.features || null,
      competitiveAdvantages: validated.competitiveAdvantages || null,
    };

    let workCollateral;
    if (existingCollateral) {
      // Update existing
      workCollateral = await prisma.workCollateral.update({
        where: { id: existingCollateral.id },
        data: {
          title: validated.name,
          contentJson,
          status: 'IN_PROGRESS',
        },
      });
    } else {
      // Create new
      workCollateral = await prisma.workCollateral.create({
        data: {
          workPackageItemId,
          type: 'PRODUCT_DEFINITION',
          title: validated.name,
          contentJson,
          status: 'IN_PROGRESS',
        },
      });

      // Update item status to IN_PROGRESS
      await prisma.workPackageItem.update({
        where: { id: workPackageItemId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    revalidatePath(`/ignite/work-item/product-definition`);
    
    return {
      success: true,
      workCollateral,
    };
  } catch (error) {
    console.error('❌ saveWorkItemProductDefinition error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        errors: error.issues,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save product definition',
    };
  }
}

/**
 * Load WorkItem Product Definition from WorkCollateral
 * Returns the saved product definition data if it exists
 */
export async function loadWorkItemProductDefinition(workPackageItemId: string) {
  try {
    // Find WorkCollateral for this item
    const collateral = await prisma.workCollateral.findFirst({
      where: {
        workPackageItemId,
        type: 'PRODUCT_DEFINITION',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!collateral || !collateral.contentJson) {
      return {
        success: true,
        data: null,
      };
    }

    // Extract data from contentJson
    const content = collateral.contentJson as Record<string, any>;
    
    return {
      success: true,
      data: {
        name: content.name || '',
        category: content.category || '',
        valueProp: content.valueProp || '',
        description: content.description || '',
        price: content.price || null,
        priceCurrency: content.priceCurrency || null,
        pricingModel: content.pricingModel || null,
        targetedTo: content.targetedTo || null,
        targetMarketSize: content.targetMarketSize || null,
        salesCycleLength: content.salesCycleLength || null,
        deliveryTimeline: content.deliveryTimeline || '',
        features: content.features || '',
        competitiveAdvantages: content.competitiveAdvantages || '',
      } as WorkItemProductDefinitionFormData,
    };
  } catch (error) {
    console.error('❌ loadWorkItemProductDefinition error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load product definition',
    };
  }
}

/**
 * Get WorkPackageItem by ID (for context)
 */
export async function getWorkPackageItem(workPackageItemId: string) {
  try {
    const item = await prisma.workPackageItem.findUnique({
      where: { id: workPackageItemId },
      include: {
        workPackage: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (!item) {
      return {
        success: false,
        error: 'WorkPackageItem not found',
      };
    }

    return {
      success: true,
      item,
    };
  } catch (error) {
    console.error('❌ getWorkPackageItem error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load work package item',
    };
  }
}


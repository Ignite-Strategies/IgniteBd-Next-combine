/**
 * Pipeline Service
 * 
 * Universal service for ensuring contacts have pipeline records.
 * 
 * Core Rule: A Contact is not fully valid unless it has a Pipeline record.
 * 
 * This service:
 * - Ensures every contact has a pipeline
 * - Creates default pipeline (prospect/interest) if missing
 * - Updates pipeline if new values provided
 * - Validates pipeline and stage values
 */

import { prisma } from '@/lib/prisma';
import { isValidPipeline, isValidStageForPipeline } from '@/lib/config/pipelineConfig';

export interface EnsurePipelineOptions {
  pipeline?: string;
  stage?: string;
  defaultPipeline?: string; // Default: 'prospect'
  defaultStage?: string;     // Default: 'interest'
}

/**
 * Ensure a contact has a pipeline record
 * 
 * - If pipeline doesn't exist → creates with defaults
 * - If pipeline exists and new values provided → updates
 * - Validates pipeline and stage values
 * 
 * @param contactId - Contact ID
 * @param options - Pipeline options (pipeline, stage, defaults)
 * @throws Error if pipeline or stage is invalid
 */
export async function ensureContactPipeline(
  contactId: string,
  options: EnsurePipelineOptions = {}
): Promise<void> {
  const {
    pipeline,
    stage,
    defaultPipeline = 'prospect',
    defaultStage = 'interest',
  } = options;

  // Check if pipeline exists
  const existing = await prisma.pipeline.findUnique({
    where: { contactId },
  });

  if (existing) {
    // Pipeline exists - update if new values provided
    if (pipeline !== undefined || stage !== undefined) {
      const finalPipeline = pipeline || existing.pipeline;
      const finalStage = stage !== undefined ? stage : existing.stage;

      // Validate pipeline
      if (!isValidPipeline(finalPipeline)) {
        throw new Error(`Invalid pipeline: ${finalPipeline}. Must be one of: prospect, client, collaborator, institution`);
      }

      // Validate stage (if provided)
      if (finalStage && !isValidStageForPipeline(finalStage, finalPipeline)) {
        throw new Error(`Invalid stage "${finalStage}" for pipeline "${finalPipeline}"`);
      }

      // Update pipeline
      await prisma.pipeline.update({
        where: { contactId },
        data: {
          pipeline: finalPipeline,
          stage: finalStage || null,
        },
      });

      console.log(`✅ Pipeline updated for contact ${contactId}: ${finalPipeline}/${finalStage || 'null'}`);
    }
    return;
  }

  // Pipeline doesn't exist - create with defaults
  const newPipeline = pipeline || defaultPipeline;
  const newStage = stage !== undefined ? stage : defaultStage;

  // Validate pipeline
  if (!isValidPipeline(newPipeline)) {
    throw new Error(`Invalid pipeline: ${newPipeline}. Must be one of: prospect, client, collaborator, institution`);
  }

  // Validate stage (if provided)
  if (newStage && !isValidStageForPipeline(newStage, newPipeline)) {
    throw new Error(`Invalid stage "${newStage}" for pipeline "${newPipeline}"`);
  }

  // Create pipeline
  await prisma.pipeline.create({
    data: {
      contactId,
      pipeline: newPipeline,
      stage: newStage,
    },
  });

  console.log(`✅ Pipeline created for contact ${contactId}: ${newPipeline}/${newStage}`);
}

/**
 * Validate pipeline and stage values
 * 
 * @param pipeline - Pipeline value to validate
 * @param stage - Stage value to validate (optional)
 * @returns Object with isValid and error message
 */
export function validatePipeline(
  pipeline?: string,
  stage?: string
): { isValid: boolean; error?: string } {
  if (!pipeline) {
    return { isValid: true }; // Pipeline is optional (will use default)
  }

  if (!isValidPipeline(pipeline)) {
    return {
      isValid: false,
      error: `Invalid pipeline: ${pipeline}. Must be one of: prospect, client, collaborator, institution`,
    };
  }

  if (stage && !isValidStageForPipeline(stage, pipeline)) {
    return {
      isValid: false,
      error: `Invalid stage "${stage}" for pipeline "${pipeline}"`,
    };
  }

  return { isValid: true };
}


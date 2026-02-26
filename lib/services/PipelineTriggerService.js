/**
 * PIPELINE TRIGGER SERVICE
 * Handles automatic pipeline conversions based on stage changes
 * 
 * Main trigger: contract-signed → converts to client pipeline with kickoff stage
 */

import { prisma } from '../prisma.js';
import { snapPipelineOnContact } from './pipelineService';

/**
 * Check if pipeline stage change triggers a conversion
 * @param {string} contactId - Contact ID
 * @param {string} newPipeline - New pipeline value
 * @param {string} newStage - New stage value
 * @returns {Promise<Object|null>} - Conversion result or null if no conversion needed
 */
export async function checkPipelineTriggers(contactId, newPipeline, newStage) {
  // Trigger: contract-signed in prospect pipeline → convert to client with kickoff
  if (newPipeline === 'prospect' && newStage === 'contract-signed') {
    return await convertProspectToClient(contactId);
  }

  return null;
}

/**
 * Convert prospect to client when contract is signed
 * @param {string} contactId - Contact ID
 * @returns {Promise<Object>} - Updated contact with new pipeline
 */
async function convertProspectToClient(contactId) {
  try {
    // Upsert Pipeline to client/kickoff
    const { randomUUID } = await import('crypto');
    const pipelineId = randomUUID();
    
    const pipeline = await prisma.pipelines.upsert({
      where: { contactId: contactId },
      update: {
        pipeline: 'client',
        stage: 'kickoff',
        updatedAt: new Date(),
      },
      create: {
        id: pipelineId,
        contactId: contactId,
        pipeline: 'client',
        stage: 'kickoff',
        updatedAt: new Date(),
      }
    });
    await snapPipelineOnContact(contactId, 'client', 'kickoff');

    // Fetch updated contact with relations
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        pipeline: true,
        contactCompany: true
      }
    });

    console.log(`✅ Pipeline conversion: Contact ${contactId} converted from prospect (contract-signed) to client (kickoff)`);

    return {
      converted: true,
      from: { pipeline: 'prospect', stage: 'contract-signed' },
      to: { pipeline: 'client', stage: 'kickoff' },
      contact
    };
  } catch (error) {
    console.error('❌ Pipeline conversion error:', error);
    throw error;
  }
}

/**
 * Apply pipeline triggers when updating a contact's pipeline
 * This should be called from the contact update route
 * @param {string} contactId - Contact ID
 * @param {string} pipeline - Pipeline value
 * @param {string} stage - Stage value
 * @returns {Promise<Object>} - Updated contact (may have been converted)
 */
export async function applyPipelineTriggers(contactId, pipeline, stage) {
  const conversion = await checkPipelineTriggers(contactId, pipeline, stage);
  
  if (conversion && conversion.converted) {
    // Return the converted contact
    return conversion.contact;
  }

  // No conversion, return null (caller should proceed with normal update)
  return null;
}


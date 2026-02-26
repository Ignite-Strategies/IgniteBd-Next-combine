/**
 * PIPELINE CONFIGURATION FOR IGNITEBD
 * Single source of truth for Contact pipelines and stages
 * Based on Contact-First Architecture with Pipeline model
 *
 * Pipeline Types: unassigned (literally unassigned), connector (warm intro / forward path),
 *   prospect, client, collaborator, institution
 * unassigned has no stages; connector has forwarded / introduction-made
 */

// OFFICIAL PIPELINE TYPES
export const OFFICIAL_PIPELINES = [
  'unassigned',   // Literally unassigned — not in any path
  'connector',   // Warm intro to a buyer: said they'd forward, or intro made
  'prospect',
  'client',
  'collaborator',
  'institution'
];

// ALL POSSIBLE STAGES
export const ALL_STAGES = [
  // Prospect stages
  'need-to-engage',  // Contact in CRM but hasn't been emailed yet
  'engaged-awaiting-response',  // Outreach sent, waiting for response (action taken)
  'interest',
  'meeting',
  'proposal',
  'contract',
  'contract-signed',  // Conversion point → becomes client
  // Client stages
  'kickoff',
  'work-started',
  'work-delivered',
  'sustainment',
  'renewal',
  'terminated-contract',
  // Collaborator stages
  'interest',
  'meeting',
  'moa',
  'agreement',
  // Institution stages
  'interest',
  'meeting',
  'moa',
  'agreement',
  // Connector stages (warm intro / forward path)
  'forwarded',           // Said they'd forward or pass along
  'introduction-made'   // Introduction to the buyer has been made
];

// PIPELINE-SPECIFIC STAGES
// Each pipeline type has its own stages
export const PIPELINE_STAGES = {
  'unassigned': [],     // Literally unassigned — no stages
  'connector': [
    'forwarded',         // Said they'd forward / pass along (e.g. to internal counsel)
    'introduction-made'  // Introduction to the buyer has been made
  ],
  'prospect': [
    'need-to-engage',    // Contact in CRM but hasn't been emailed yet
    'engaged-awaiting-response',  // Outreach sent, waiting for response (action taken)
    'interest',          // Initial interest expressed
    'meeting',           // Meeting scheduled/held
    'proposal',          // Proposal sent
    'contract',          // Contract in progress
    'contract-signed'    // Contract signed → CONVERTS TO CLIENT
  ],
  'client': [
    'kickoff',           // Project kickoff
    'work-started',      // Work has started
    'work-delivered',    // Work delivered
    'sustainment',       // Sustainment phase
    'renewal',           // Renewal (upsell - starting new work)
    'terminated-contract' // Contract terminated
  ],
  'collaborator': [
    'interest',         // Initial interest
    'meeting',          // Meeting scheduled/held
    'moa',              // Memorandum of Agreement
    'agreement'         // Formal agreement
  ],
  'institution': [
    'interest',         // Initial interest
    'meeting',          // Meeting scheduled/held
    'moa',              // Memorandum of Agreement
    'agreement'         // Formal agreement
  ]
};

// Validate pipeline type
export const isValidPipeline = (pipeline) => {
  return OFFICIAL_PIPELINES.includes(pipeline);
};

// Get stages for specific pipeline
export const getStagesForPipeline = (pipeline) => {
  return PIPELINE_STAGES[pipeline] || [];
};

// Validate stage for pipeline
export const isValidStageForPipeline = (stage, pipeline) => {
  // Unassigned pipeline doesn't require a stage
  if (pipeline === 'unassigned') {
    return !stage || stage === null || stage === '';
  }
  const pipelineStages = getStagesForPipeline(pipeline);
  return pipelineStages.includes(stage);
};

// Get pipeline config for API response
export const getPipelineConfig = () => {
  return {
    pipelines: PIPELINE_STAGES,
    officialPipelines: OFFICIAL_PIPELINES,
    allStages: ALL_STAGES
  };
};


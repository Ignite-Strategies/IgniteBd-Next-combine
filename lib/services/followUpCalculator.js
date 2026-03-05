/**
 * @deprecated Use emailCadenceService directly.
 * Re-export for backward compatibility.
 */
export {
  calculateNextSendDate,
  isDueForFollowUp,
  stampLastEngagement,
  snapContactLastContactedAt,
} from './emailCadenceService.js';

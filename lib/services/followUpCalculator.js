/**
 * @deprecated Use emailCadenceService directly.
 * Re-export for backward compatibility.
 */
export {
  getLastSendDate,
  calculateNextSendDate,
  isDueForFollowUp,
  stampLastEngagement,
  snapContactLastContactedAt,
} from './emailCadenceService.js';

/**
 * @deprecated Use emailCadenceService. Pipeline is source of truth; sequence order + pipeline determine next send.
 * Re-export for backward compatibility.
 */
export {
  getLastSendDate,
  calculateNextSendDate,
  isDueForFollowUp,
  snapContactLastContactedAt,
} from './emailCadenceService.js';

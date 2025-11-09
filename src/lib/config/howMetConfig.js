/**
 * HOW MET CONFIGURATION
 * Defines how we met/know a contact
 */

export const HOW_MET_TYPES = {
  PERSONAL_RELATIONSHIP: 'personal-relationship',
  REFERRAL: 'referral',
  EVENT_CONFERENCE: 'event-conference',
  COLD_OUTREACH: 'cold-outreach'
};

export const HOW_MET_LABELS = {
  [HOW_MET_TYPES.PERSONAL_RELATIONSHIP]: 'Personal Relationship',
  [HOW_MET_TYPES.REFERRAL]: 'Referral',
  [HOW_MET_TYPES.EVENT_CONFERENCE]: 'Met at Event/Conference',
  [HOW_MET_TYPES.COLD_OUTREACH]: 'Cold Outreach'
};

export default HOW_MET_TYPES;


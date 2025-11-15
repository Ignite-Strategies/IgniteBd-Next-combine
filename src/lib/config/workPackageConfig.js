export const WORK_PACKAGE_CONFIG = [
  { id: "target_persona", label: "Target Persona", type: "persona" },
  { id: "outreach_template", label: "Outreach Template", type: "template" },
  { id: "industry_event_targets", label: "Industry Event Targets", type: "event_targets" },
  { id: "blog_content", label: "Blog Content", type: "blog" },
  { id: "presentation_deck", label: "Presentation Deck", type: "deck" },
  { id: "landing_page", label: "Landing Page", type: "landing_page" },
  { id: "lead_form", label: "Lead Form", type: "lead_form" }
];

/**
 * Map config type to WorkItemType enum
 */
export const mapConfigTypeToWorkItemType = (configType) => {
  const mapping = {
    persona: 'PERSONA',
    template: 'OUTREACH_TEMPLATE',
    event_targets: 'CLE_DECK', // Updated: event_targets maps to CLE_DECK (EVENT_CLE_PLAN deprecated)
    blog: 'BLOG',
    deck: 'PRESENTATION_DECK', // Presentation Deck, not CLE_DECK
    landing_page: 'LANDING_PAGE',
    lead_form: 'LANDING_PAGE', // Lead forms can be part of landing pages
  };
  return mapping[configType] || null;
};

/**
 * Get default quantity for a config item
 */
export const getDefaultQuantity = (configType) => {
  const defaults = {
    persona: 3,
    template: 10,
    event_targets: 2,
    blog: 5,
    deck: 1,
    landing_page: 1,
    lead_form: 1,
  };
  return defaults[configType] || 1;
};

/**
 * Get item by id
 */
export const getConfigItemById = (id) => {
  return WORK_PACKAGE_CONFIG.find(item => item.id === id);
};

/**
 * Get item by type
 */
export const getConfigItemByType = (type) => {
  return WORK_PACKAGE_CONFIG.find(item => item.type === type);
};


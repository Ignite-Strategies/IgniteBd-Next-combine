/**
 * Product/Service Configuration
 * 
 * Defines the schema, validation rules, and UI configuration for products/services.
 * This config-driven approach ensures consistency across frontend, backend, and database.
 */

export const PRODUCT_CONFIG = {
  // Field definitions with validation and UI metadata
  fields: {
    name: {
      type: 'string',
      required: true,
      label: 'Product/Service Name',
      placeholder: 'e.g., Business Development Platform, Ignite CRM Automation',
      helpText: 'A clear, concise name for your product or service',
      maxLength: 255,
    },
    valueProp: {
      type: 'textarea',
      required: false,
      label: 'Value Proposition',
      placeholder: 'What specific outcome or benefit does this product deliver?',
      helpText: 'This is used by BD Intelligence to calculate fit scores with contacts',
      rows: 4,
    },
    description: {
      type: 'textarea',
      required: false,
      label: 'Description',
      placeholder: 'Additional details about the product experience, features, or use cases.',
      helpText: 'Optional: Additional details about the product',
      rows: 3,
    },
    price: {
      type: 'number',
      required: false,
      label: 'Price',
      placeholder: '0.00',
      helpText: 'Product/service price for BD Intelligence scoring',
      min: 0,
      step: 0.01,
    },
    priceCurrency: {
      type: 'select',
      required: false,
      label: 'Currency',
      options: [
        { value: 'USD', label: 'USD ($)' },
        { value: 'EUR', label: 'EUR (€)' },
        { value: 'GBP', label: 'GBP (£)' },
        { value: 'CAD', label: 'CAD ($)' },
      ],
      defaultValue: 'USD',
      helpText: 'Currency for the price',
    },
    pricingModel: {
      type: 'select',
      required: false,
      label: 'Pricing Model',
      options: [
        { value: 'one-time', label: 'One-Time Payment' },
        { value: 'recurring', label: 'Recurring (Monthly/Annual)' },
        { value: 'usage-based', label: 'Usage-Based' },
        { value: 'freemium', label: 'Freemium' },
        { value: 'custom', label: 'Custom' },
      ],
      helpText: 'How is this product/service priced?',
    },
    category: {
      type: 'string',
      required: false,
      label: 'Category',
      placeholder: 'e.g., Software, Consulting, Training',
      helpText: 'Category or type of product/service',
      maxLength: 100,
    },
    deliveryTimeline: {
      type: 'string',
      required: false,
      label: 'Delivery Timeline',
      placeholder: 'e.g., 2-4 weeks, 3 months, Immediate',
      helpText: 'How long does it take to deliver this product/service?',
      maxLength: 100,
    },
    targetMarketSize: {
      type: 'select',
      required: false,
      label: 'Target Market Size',
      options: [
        { value: 'enterprise', label: 'Enterprise (1000+ employees)' },
        { value: 'mid-market', label: 'Mid-Market (100-999 employees)' },
        { value: 'small-business', label: 'Small Business (10-99 employees)' },
        { value: 'startup', label: 'Startup (1-9 employees)' },
        { value: 'individual', label: 'Individual/Solo' },
      ],
      helpText: 'What size companies is this product/service targeted to?',
    },
    salesCycleLength: {
      type: 'select',
      required: false,
      label: 'Sales Cycle Length',
      options: [
        { value: 'immediate', label: 'Immediate (Same Day)' },
        { value: 'short', label: 'Short (1-2 weeks)' },
        { value: 'medium', label: 'Medium (1-3 months)' },
        { value: 'long', label: 'Long (3-6 months)' },
        { value: 'very-long', label: 'Very Long (6+ months)' },
      ],
      helpText: 'Typical length of the sales cycle for this product/service',
    },
    features: {
      type: 'textarea',
      required: false,
      label: 'Key Features',
      placeholder: 'List key features, one per line or bullet points',
      helpText: 'Main features or capabilities of this product/service',
      rows: 4,
    },
    competitiveAdvantages: {
      type: 'textarea',
      required: false,
      label: 'Competitive Advantages',
      placeholder: 'What makes this product/service unique or better than alternatives?',
      helpText: 'Unique selling points and competitive advantages',
      rows: 3,
    },
    targetedTo: {
      type: 'persona-select',
      required: false,
      label: 'Targeted To',
      helpText: 'Which persona is this product targeted to?',
    },
  },

  // Field groups for UI organization
  fieldGroups: [
    {
      name: 'Basic Information',
      fields: ['name', 'category', 'valueProp', 'description'],
    },
    {
      name: 'Pricing',
      fields: ['price', 'priceCurrency', 'pricingModel'],
    },
    {
      name: 'Targeting & Market',
      fields: ['targetedTo', 'targetMarketSize', 'salesCycleLength'],
    },
    {
      name: 'Details',
      fields: ['deliveryTimeline', 'features', 'competitiveAdvantages'],
    },
  ],

  // Default values for new products
  defaults: {
    priceCurrency: 'USD',
    pricingModel: null,
    category: null,
    deliveryTimeline: null,
    targetMarketSize: null,
    salesCycleLength: null,
    features: null,
    competitiveAdvantages: null,
    targetedTo: null,
  },
};

/**
 * Get field definition by name
 */
export function getFieldConfig(fieldName) {
  return PRODUCT_CONFIG.fields[fieldName];
}

/**
 * Get all required fields
 */
export function getRequiredFields() {
  return Object.entries(PRODUCT_CONFIG.fields)
    .filter(([_, config]) => config.required)
    .map(([name]) => name);
}

/**
 * Get fields by group
 */
export function getFieldsByGroup(groupName) {
  const group = PRODUCT_CONFIG.fieldGroups.find((g) => g.name === groupName);
  return group ? group.fields : [];
}

/**
 * Validate field value
 */
export function validateField(fieldName, value) {
  const config = getFieldConfig(fieldName);
  if (!config) return { valid: true };

  if (config.required && (!value || value.toString().trim() === '')) {
    return { valid: false, error: `${config.label} is required` };
  }

  if (config.type === 'number' && value !== null && value !== '') {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return { valid: false, error: `${config.label} must be a number` };
    }
    if (config.min !== undefined && numValue < config.min) {
      return { valid: false, error: `${config.label} must be at least ${config.min}` };
    }
  }

  if (config.maxLength && value && value.toString().length > config.maxLength) {
    return {
      valid: false,
      error: `${config.label} must be no more than ${config.maxLength} characters`,
    };
  }

  return { valid: true };
}

/**
 * Validate product data object
 */
export function validateProduct(productData) {
  const errors = {};
  let isValid = true;

  Object.keys(PRODUCT_CONFIG.fields).forEach((fieldName) => {
    const validation = validateField(fieldName, productData[fieldName]);
    if (!validation.valid) {
      errors[fieldName] = validation.error;
      isValid = false;
    }
  });

  return { isValid, errors };
}


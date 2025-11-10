/**
 * Product Service Mapper
 * 
 * Maps between frontend form data, database schema, and API payloads
 * using the product configuration. Ensures consistency across the stack.
 */

import { PRODUCT_CONFIG, validateProduct } from '@/lib/config/productConfig';

/**
 * Map form data to database schema
 * Converts frontend form values to database-ready format
 */
export function mapFormToDatabase(formData) {
  const dbData = {
    name: formData.name?.trim() || null,
    valueProp: formData.valueProp?.trim() || null,
    description: formData.description?.trim() || null,
    price: formData.price ? parseFloat(formData.price) : null,
    priceCurrency:
      formData.price && formData.priceCurrency
        ? formData.priceCurrency
        : null,
    pricingModel: formData.pricingModel || null,
    category: formData.category?.trim() || null,
    deliveryTimeline: formData.deliveryTimeline?.trim() || null,
    targetMarketSize: formData.targetMarketSize || null,
    salesCycleLength: formData.salesCycleLength || null,
    features: formData.features?.trim() || null,
    competitiveAdvantages: formData.competitiveAdvantages?.trim() || null,
    targetedTo: formData.targetedTo || null,
    companyHQId: formData.companyId || formData.companyHQId || null,
  };

  // Clean up empty values (but keep required fields)
  Object.keys(dbData).forEach((key) => {
    if (key === 'name' || key === 'companyHQId') {
      // Keep required fields
      return;
    }
    // Remove empty optional fields
    if (dbData[key] === null || dbData[key] === undefined || dbData[key] === '') {
      delete dbData[key];
    }
  });

  return dbData;
}

/**
 * Map database record to form data
 * Converts database record to frontend form format
 */
export function mapDatabaseToForm(dbRecord) {
  return {
    name: dbRecord.name || '',
    valueProp: dbRecord.valueProp || '',
    description: dbRecord.description || '',
    price: dbRecord.price?.toString() || '',
    priceCurrency: dbRecord.priceCurrency || PRODUCT_CONFIG.defaults.priceCurrency,
    pricingModel: dbRecord.pricingModel || '',
    category: dbRecord.category || '',
    deliveryTimeline: dbRecord.deliveryTimeline || '',
    targetMarketSize: dbRecord.targetMarketSize || '',
    salesCycleLength: dbRecord.salesCycleLength || '',
    features: dbRecord.features || '',
    competitiveAdvantages: dbRecord.competitiveAdvantages || '',
    targetedTo: dbRecord.targetedTo || '',
    companyId: dbRecord.companyHQId || '',
  };
}

/**
 * Map database record to API response
 * Formats database record for API responses
 */
export function mapDatabaseToApi(dbRecord) {
  return {
    id: dbRecord.id,
    companyHQId: dbRecord.companyHQId,
    name: dbRecord.name,
    valueProp: dbRecord.valueProp,
    description: dbRecord.description,
    price: dbRecord.price,
    priceCurrency: dbRecord.priceCurrency,
    pricingModel: dbRecord.pricingModel,
    category: dbRecord.category,
    deliveryTimeline: dbRecord.deliveryTimeline,
    targetMarketSize: dbRecord.targetMarketSize,
    salesCycleLength: dbRecord.salesCycleLength,
    features: dbRecord.features,
    competitiveAdvantages: dbRecord.competitiveAdvantages,
    targetedTo: dbRecord.targetedTo,
    createdAt: dbRecord.createdAt,
    updatedAt: dbRecord.updatedAt,
  };
}

/**
 * Validate and map request body for API routes
 * Validates incoming data and maps to database format
 */
export function validateAndMapRequest(body) {
  // First validate
  const validation = validateProduct(body);
  if (!validation.isValid) {
    return {
      valid: false,
      errors: validation.errors,
    };
  }

  // Then map to database format
  const dbData = mapFormToDatabase(body);

  return {
    valid: true,
    data: dbData,
  };
}

/**
 * Get Prisma select object for all product fields
 */
export function getProductSelect() {
  return {
    id: true,
    companyHQId: true,
    name: true,
    valueProp: true,
    description: true,
    price: true,
    priceCurrency: true,
    pricingModel: true,
    category: true,
    deliveryTimeline: true,
    targetMarketSize: true,
    salesCycleLength: true,
    features: true,
    competitiveAdvantages: true,
    targetedTo: true,
    createdAt: true,
    updatedAt: true,
  };
}

/**
 * Get Prisma create/update data object
 * Ensures only valid fields are included (excluding companyHQId which is handled separately)
 */
export function getProductData(body) {
  const mapped = mapFormToDatabase(body);
  
  // Remove companyHQId from data object (it's handled separately in route handlers)
  const { companyHQId, ...data } = mapped;
  
  // Also remove any undefined values to avoid Prisma errors
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined) {
      delete data[key];
    }
  });
  
  return data;
}


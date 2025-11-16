/**
 * CSV Header Validator
 * Validates CSV headers before parsing data
 */

/**
 * Normalize header name for comparison (case-insensitive, trim whitespace)
 */
function normalizeHeader(header) {
  return header.toLowerCase().trim();
}

/**
 * Validate CSV headers against required and optional headers
 * @param {Array} requiredHeaders - Array of required header names (case-insensitive)
 * @param {Array} optionalHeaders - Array of optional header names (case-insensitive)
 * @param {Array} uploadedHeaders - Array of headers from uploaded CSV
 * @returns {Object} { isValid, missingRequired, extraHeaders, warnings }
 */
export function validateCsvHeaders(requiredHeaders, optionalHeaders, uploadedHeaders) {
  const normalizedRequired = requiredHeaders.map(normalizeHeader);
  const normalizedOptional = optionalHeaders.map(normalizeHeader);
  const normalizedUploaded = uploadedHeaders.map(normalizeHeader);

  // Find missing required headers
  const missingRequired = normalizedRequired.filter(
    (required) => !normalizedUploaded.includes(required)
  );

  // Find extra headers (not in required or optional)
  const allAllowed = [...normalizedRequired, ...normalizedOptional];
  const extraHeaders = normalizedUploaded.filter(
    (uploaded) => !allAllowed.includes(uploaded)
  );

  const isValid = missingRequired.length === 0;
  const warnings = [];

  if (extraHeaders.length > 0) {
    warnings.push(
      `Extra columns detected: ${extraHeaders.join(', ')}. These will be ignored.`
    );
  }

  return {
    isValid,
    missingRequired: missingRequired.length > 0 ? missingRequired : [],
    extraHeaders: extraHeaders.length > 0 ? extraHeaders : [],
    warnings,
  };
}

/**
 * Phase CSV header validation
 */
export function validatePhaseCsvHeaders(uploadedHeaders) {
  const requiredHeaders = ['Phase Name'];
  const optionalHeaders = ['Description', 'Duration (Days)'];

  return validateCsvHeaders(requiredHeaders, optionalHeaders, uploadedHeaders);
}

/**
 * Deliverable CSV header validation
 */
export function validateDeliverableCsvHeaders(uploadedHeaders) {
  const requiredHeaders = ['Phase Name', 'Deliverable Name', 'Quantity'];
  const optionalHeaders = ['Description', 'Unit', 'Duration (Days)'];

  return validateCsvHeaders(requiredHeaders, optionalHeaders, uploadedHeaders);
}


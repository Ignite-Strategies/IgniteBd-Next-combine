/**
 * Universal Parser Type Prompts
 * 
 * DEPRECATED: This file is kept for backward compatibility.
 * New architecture uses config-based system in src/lib/parsers/configs/
 * 
 * Re-export types and schemas for backward compatibility
 */

// Re-export types from parserConfigs
export type { UniversalParserType } from './parserConfigs';

// Re-export product schema from configs for backward compatibility
export { productDefinitionSchema } from './configs/product';
export type { ProductDefinitionParsed } from './configs/product';

// Legacy exports - use parserConfigs.ts instead
export { getParserConfig } from './parserConfigs';


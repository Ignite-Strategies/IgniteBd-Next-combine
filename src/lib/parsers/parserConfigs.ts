import { z } from 'zod';
import { parserConfig as productConfig } from './configs/product';
import { parserConfig as ecosystemConfig } from './configs/ecosystem';
import { parserConfig as eventConfig } from './configs/events';
import { parserConfig as blogConfig } from './configs/blog';
import { parserConfig as genericConfig } from './configs/generic';

/**
 * Universal Parser Type Enum
 */
export type UniversalParserType =
  | 'product_definition'
  | 'ecosystem_map'
  | 'event_selection'
  | 'blog'
  | 'generic';

/**
 * ParserConfig Interface
 * Each parser type must provide a complete config with all required fields
 */
export interface ParserConfig {
  name: string;
  schema: z.ZodSchema<any>;
  systemPrompt: string;
  buildUserPrompt: (raw: string, context: string | null) => string;
  normalize: (parsed: any) => any;
}

/**
 * Global Parser Config Registry
 * Maps parser types to their configs
 */
export const PARSER_CONFIGS: Record<UniversalParserType, ParserConfig> = {
  product_definition: productConfig,
  ecosystem_map: ecosystemConfig,
  event_selection: eventConfig,
  blog: blogConfig,
  generic: genericConfig,
};

/**
 * Get parser config for a given type
 */
export function getParserConfig(type: UniversalParserType): ParserConfig {
  const config = PARSER_CONFIGS[type];
  if (!config) {
    throw new Error(`Parser type "${type}" is not yet implemented`);
  }
  return config;
}


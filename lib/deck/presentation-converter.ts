/**
 * Presentation Converter
 * Converts Presentation.slides format to DeckSpec format for Gamma API
 */

import type { DeckSpec } from './blob-mapper';

/**
 * Presentation slides format:
 * {
 *   sections: [
 *     { title: string, bullets: string[] }
 *   ]
 * }
 */
export interface PresentationSlides {
  sections?: Array<{
    title: string;
    bullets?: string[];
    imageUrl?: string;
    notes?: string;
  }>;
}

/**
 * Converts Presentation.slides JSON to DeckSpec format
 * 
 * @param presentationTitle - The presentation title
 * @param presentationDescription - Optional presentation description (used as subtitle)
 * @param slides - The Presentation.slides JSON object
 * @returns DeckSpec ready for Gamma API
 */
export function presentationToDeckSpec(
  presentationTitle: string,
  presentationDescription?: string | null,
  slides?: PresentationSlides | null
): DeckSpec {
  const deckSpec: DeckSpec = {
    title: presentationTitle,
    slides: [],
  };

  // Add subtitle if description exists
  if (presentationDescription) {
    deckSpec.subtitle = presentationDescription;
  }

  // Convert sections to slides
  if (slides?.sections && Array.isArray(slides.sections)) {
    deckSpec.slides = slides.sections.map((section) => ({
      title: section.title || 'Untitled Slide',
      bullets: section.bullets || [],
      imageUrl: section.imageUrl,
      notes: section.notes,
    }));
  }

  // Ensure at least one slide exists
  if (deckSpec.slides.length === 0) {
    deckSpec.slides.push({
      title: 'Introduction',
      bullets: [],
    });
  }

  return deckSpec;
}


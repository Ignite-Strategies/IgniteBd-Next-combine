/**
 * Blob Mapper for Gamma API
 * Converts IgniteBD DeckSpec to Gamma-friendly human-readable structured narrative
 * 
 * Gamma requires a human-readable structured narrative, not JSON or markdown.
 * Use clear delimiters: "Presentation Title:", "Slide 1: Title", dash-prefixed bullets, optional "Notes:" section
 */

export interface DeckSpec {
  title: string;
  subtitle?: string;
  brand?: {
    primaryColor?: string;
    accentColor?: string;
    font?: string;
  };
  slides: {
    title: string;
    bullets?: string[];
    imageUrl?: string;
    notes?: string;
  }[];
}

/**
 * Builds a Gamma-friendly human-readable structured narrative from a DeckSpec
 * 
 * Format:
 * Presentation Title: {Deck Title}
 * 
 * Slide 1: {Slide Title}
 * - {bullet 1}
 * - {bullet 2}
 * Notes: {optional notes}
 * 
 * Slide 2: {Slide Title}
 * - {bullet 1}
 * ...
 */
export function buildGammaBlob(deck: DeckSpec): string {
  const lines: string[] = [];

  // Presentation Title
  lines.push(`Presentation Title: ${deck.title}`);

  // Subtitle (if present)
  if (deck.subtitle) {
    lines.push(`Subtitle: ${deck.subtitle}`);
  }

  // Brand section (if present) - include as context
  if (deck.brand) {
    lines.push('');
    if (deck.brand.primaryColor) {
      lines.push(`Primary Color: ${deck.brand.primaryColor}`);
    }
    if (deck.brand.accentColor) {
      lines.push(`Accent Color: ${deck.brand.accentColor}`);
    }
    if (deck.brand.font) {
      lines.push(`Font: ${deck.brand.font}`);
    }
  }

  // Slides
  deck.slides.forEach((slide, index) => {
    lines.push('');
    lines.push(`Slide ${index + 1}: ${slide.title}`);

    // Bullets (dash-prefixed)
    if (slide.bullets && slide.bullets.length > 0) {
      slide.bullets.forEach((bullet) => {
        lines.push(`- ${bullet}`);
      });
    }

    // Image (if present)
    if (slide.imageUrl) {
      lines.push(`Image: ${slide.imageUrl}`);
    }

    // Notes (optional)
    if (slide.notes) {
      lines.push(`Notes: ${slide.notes}`);
    }
  });

  return lines.join('\n');
}


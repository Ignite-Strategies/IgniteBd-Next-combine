/**
 * Blob Mapper for Gamma API
 * Converts IgniteBD DeckSpec to Gamma-friendly blob format
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
 * Builds a Gamma-friendly blob string from a DeckSpec
 * 
 * Format:
 * # {Deck Title}
 * ## {Subtitle}
 * 
 * Brand:
 * - Primary Color: {color}
 * - Accent Color: {color}
 * - Font: {font}
 * 
 * ---
 * 
 * # Slide 1 — {Slide Title}
 * {each bullet as "- {bullet}"}
 * {if imageUrl: "[Image: {url}]"}
 * {if notes: "Notes: {notes}"}
 * 
 * ---
 * 
 * # Slide 2 — {Slide Title}
 * ...
 */
export function buildGammaBlob(deck: DeckSpec): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${deck.title}`);

  // Subtitle (if present)
  if (deck.subtitle) {
    lines.push(`## ${deck.subtitle}`);
  }

  // Brand section (if present)
  if (deck.brand) {
    lines.push('');
    lines.push('Brand:');
    if (deck.brand.primaryColor) {
      lines.push(`- Primary Color: ${deck.brand.primaryColor}`);
    }
    if (deck.brand.accentColor) {
      lines.push(`- Accent Color: ${deck.brand.accentColor}`);
    }
    if (deck.brand.font) {
      lines.push(`- Font: ${deck.brand.font}`);
    }
  }

  // Slides
  deck.slides.forEach((slide, index) => {
    // Separator (except before first slide if no brand section)
    if (index > 0 || deck.brand) {
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Slide title
    lines.push(`# Slide ${index + 1} — ${slide.title}`);

    // Bullets
    if (slide.bullets && slide.bullets.length > 0) {
      slide.bullets.forEach((bullet) => {
        lines.push(`- ${bullet}`);
      });
    }

    // Image
    if (slide.imageUrl) {
      lines.push(`[Image: ${slide.imageUrl}]`);
    }

    // Notes
    if (slide.notes) {
      lines.push(`Notes: ${slide.notes}`);
    }
  });

  return lines.join('\n');
}


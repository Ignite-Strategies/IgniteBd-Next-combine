/**
 * Blog Text Assembly Utility
 * 
 * Pure text assembly with no dependencies.
 * Safe for both client and server use.
 */

export type BlogTextInput = {
  title: string | null;
  subtitle?: string | null;
  body?: string | null;
};

/**
 * Assemble blog content into a single text string
 * 
 * @param input - Blog content to assemble
 * @returns Assembled text (guaranteed non-empty)
 */
export function assembleBlogText(input: BlogTextInput): string {
  let documentText = '';
  
  // Title (or "Untitled Blog") + \n
  const documentTitle = input.title || 'Untitled Blog';
  documentText += documentTitle + '\n';
  
  // Subtitle (if present) + \n\n
  if (input.subtitle) {
    documentText += input.subtitle + '\n\n';
  } else {
    documentText += '\n';
  }
  
  // Body (if present)
  if (input.body) {
    // Normalize newlines (\r\n → \n)
    const normalizedBody = input.body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    documentText += normalizedBody;
  }
  
  return documentText || ' ';
}

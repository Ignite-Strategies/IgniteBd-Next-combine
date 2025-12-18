/**
 * Blog Content Formatter
 * 
 * Intelligently formats plain text blog content into properly structured HTML
 * Handles various paragraph styles, headings, lists, and line breaks
 */

import React from 'react';

export interface FormatterOptions {
  detectHeadings?: boolean;
  detectLists?: boolean;
  minParagraphLength?: number;
}

const defaultOptions: FormatterOptions = {
  detectHeadings: true,
  detectLists: true,
  minParagraphLength: 10,
};

/**
 * Main formatter function - converts plain text to formatted React elements
 */
export function formatBlogContent(
  text: string,
  options: FormatterOptions = {}
): React.ReactElement[] {
  const opts = { ...defaultOptions, ...options };
  
  if (!text || !text.trim()) {
    return [<p key="empty" className="text-gray-500">No content available</p>];
  }

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into lines and clean up
  const lines = normalized.split('\n').map(line => line.trim());
  
  const elements: React.ReactElement[] = [];
  let currentParagraph: string[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    
    const combined = currentParagraph.join(' ').trim();
    if (combined.length < opts.minParagraphLength!) {
      // Very short - might be spacing or heading
      if (opts.detectHeadings && isHeading(combined)) {
        elements.push(
          <h3 key={key++} className="text-xl font-bold text-gray-900 mt-6 mb-3">
            {combined}
          </h3>
        );
      } else if (combined.length > 0) {
        elements.push(
          <p key={key++} className="text-gray-800 leading-relaxed mb-4 text-lg">
            {combined}
          </p>
        );
      }
    } else {
      elements.push(
        <p key={key++} className="text-gray-800 leading-relaxed mb-4 text-lg">
          {combined}
        </p>
      );
    }
    
    currentParagraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    
    elements.push(
      <ul key={key++} className="list-disc list-inside space-y-2 mb-4 ml-4">
        {listItems.map((item, idx) => (
          <li key={idx} className="text-gray-800 leading-relaxed text-lg">
            {item}
          </li>
        ))}
      </ul>
    );
    
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Empty line - flush current paragraph/list
    if (line === '') {
      flushList();
      flushParagraph();
      continue;
    }

    // Check if it's a list item
    if (opts.detectLists && isListItem(line)) {
      flushParagraph(); // Flush any pending paragraph first
      const cleaned = cleanListItem(line);
      listItems.push(cleaned);
      continue;
    }

    // If we have pending list items and this isn't a list item, flush the list
    if (listItems.length > 0) {
      flushList();
    }

    // Check if it's a heading
    if (opts.detectHeadings && isHeading(line)) {
      flushParagraph();
      flushList();
      elements.push(
        <h3 key={key++} className="text-xl font-bold text-gray-900 mt-6 mb-3">
          {line}
        </h3>
      );
      continue;
    }

    // Regular text - add to current paragraph
    currentParagraph.push(line);
  }

  // Flush any remaining content
  flushList();
  flushParagraph();

  return elements.length > 0 
    ? elements 
    : [<p key="empty" className="text-gray-500">No content to display</p>];
}

/**
 * Check if a line is likely a heading
 */
function isHeading(line: string): boolean {
  const trimmed = line.trim();
  
  // Too long to be a heading
  if (trimmed.length > 80) return false;
  
  // All caps and short
  if (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return true;
  }
  
  // Ends with colon (section marker)
  if (trimmed.length < 60 && trimmed.endsWith(':') && !trimmed.includes(',')) {
    return true;
  }
  
  // Short line with no sentence ending
  if (trimmed.length < 50 && !trimmed.match(/[.!?]$/)) {
    // Check if next line looks like body text
    return true;
  }
  
  return false;
}

/**
 * Check if a line is a list item
 */
function isListItem(line: string): boolean {
  const trimmed = line.trim();
  
  // Starts with bullet characters
  if (/^[\-\*\•\→]\s+.+/.test(trimmed)) return true;
  
  // Starts with number followed by period or parenthesis
  if (/^\d+[\.\)]\s+.+/.test(trimmed)) return true;
  
  return false;
}

/**
 * Clean list item by removing bullet/number prefix
 */
function cleanListItem(line: string): string {
  return line.trim().replace(/^[\-\*\•\→]\s+/, '').replace(/^\d+[\.\)]\s+/, '');
}

/**
 * Simple formatter that just adds paragraph breaks
 * Useful for very simple content or when you want minimal formatting
 */
export function formatSimple(text: string): React.ReactElement[] {
  if (!text || !text.trim()) {
    return [<p key="empty" className="text-gray-500">No content available</p>];
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split(/\n+/).filter(p => p.trim());
  
  return paragraphs.map((para, idx) => (
    <p key={idx} className="text-gray-800 leading-relaxed mb-4 text-lg">
      {para.trim()}
    </p>
  ));
}

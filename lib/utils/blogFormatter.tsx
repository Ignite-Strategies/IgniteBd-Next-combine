/**
 * Blog Content Formatter
 * 
 * Intelligently formats blog content into properly structured HTML
 * Supports both Markdown and plain text formats
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface FormatterOptions {
  detectHeadings?: boolean;
  detectLists?: boolean;
  minParagraphLength?: number;
  forceMarkdown?: boolean; // Force Markdown parsing even if no MD syntax detected
  forcePlainText?: boolean; // Force plain text formatting (no MD parsing)
}

const defaultOptions: FormatterOptions = {
  detectHeadings: true,
  detectLists: true,
  minParagraphLength: 10,
  forceMarkdown: false,
  forcePlainText: false,
};

/**
 * Main formatter function - converts text to formatted React elements
 * Automatically detects Markdown and renders accordingly
 */
export function formatBlogContent(
  text: string,
  options: FormatterOptions = {}
): React.ReactElement | React.ReactElement[] {
  const opts = { ...defaultOptions, ...options };
  
  if (!text || !text.trim()) {
    return [<p key="empty" className="text-gray-500">No content available</p>];
  }

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Check if text contains Markdown syntax
  const hasMarkdown = opts.forceMarkdown || (
    !opts.forcePlainText && (
      /^#{1,6}\s/.test(normalized) ||           // Headings: # Heading
      /\*\*.*\*\*/.test(normalized) ||          // Bold: **text**
      /\*.*\*/.test(normalized) ||              // Italic: *text*
      /^\s*[-*+]\s/.test(normalized) ||         // Lists: - item
      /^\s*\d+\.\s/.test(normalized) ||         // Numbered lists: 1. item
      /\[.*\]\(.*\)/.test(normalized)           // Links: [text](url)
    )
  );
  
  // If Markdown detected, use Markdown renderer
  if (hasMarkdown) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-8" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-gray-900 mb-3 mt-6" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-gray-900 mb-3 mt-6" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-lg font-bold text-gray-900 mb-2 mt-4" {...props} />,
          p: ({ node, ...props }) => <p className="text-gray-800 leading-relaxed mb-4 text-lg" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-2 mb-4 ml-4" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-2 mb-4 ml-4" {...props} />,
          li: ({ node, ...props }) => <li className="text-gray-800 leading-relaxed text-lg" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          a: ({ node, ...props }) => <a className="text-blue-600 hover:text-blue-800 underline" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4" {...props} />
          ),
          code: ({ node, inline, ...props }: any) => 
            inline 
              ? <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props} />
              : <code className="block bg-gray-100 p-4 rounded text-sm font-mono overflow-x-auto mb-4" {...props} />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    );
  }
  
  // Fallback to plain text formatting
  // Check if text has any newlines at all
  const hasNewlines = normalized.includes('\n');
  
  // If no newlines, treat as continuous text and split intelligently
  if (!hasNewlines) {
    return formatContinuousText(normalized, opts);
  }
  
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
 * Format continuous text (no newlines) by splitting into logical paragraphs
 */
function formatContinuousText(
  text: string,
  options: FormatterOptions
): React.ReactElement[] {
  // Split into sentences using common sentence endings
  const sentenceRegex = /([^.!?]+[.!?]+(?:\s+|$))/g;
  const sentences = text.match(sentenceRegex) || [];
  
  if (sentences.length === 0) {
    // Fallback: just return the whole text as one paragraph
    return [
      <p key={0} className="text-gray-800 leading-relaxed mb-4 text-lg">
        {text.trim()}
      </p>
    ];
  }

  const elements: React.ReactElement[] = [];
  let key = 0;
  
  // Group sentences into paragraphs (3-5 sentences per paragraph for readability)
  const sentencesPerParagraph = 4;
  
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    const paragraphSentences = sentences.slice(i, i + sentencesPerParagraph);
    const paragraphText = paragraphSentences.join(' ').trim();
    
    if (paragraphText) {
      elements.push(
        <p key={key++} className="text-gray-800 leading-relaxed mb-4 text-lg">
          {paragraphText}
        </p>
      );
    }
  }
  
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

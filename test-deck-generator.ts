/**
 * Test script for Deck Generator
 * 
 * Run with: npx tsx test-deck-generator.ts
 * 
 * This tests the blob mapper with a sample DeckSpec
 */

import { buildGammaBlob, type DeckSpec } from './src/lib/deck/blob-mapper';

// Sample DeckSpec as specified in requirements
const sample: DeckSpec = {
  title: 'GovCon Mastery',
  subtitle: 'BusinessPoint Law',
  brand: {
    primaryColor: '#1A2B44',
    accentColor: '#D9A441',
    font: 'Montserrat',
  },
  slides: [
    {
      title: 'The Problem',
      bullets: [
        'Agencies struggle with fragmented compliance.',
        'Small firms drown in bid complexity.',
      ],
    },
    {
      title: 'Our Solution',
      bullets: [
        'Predictive compliance automation.',
        'BD intelligence tailored to persona.',
      ],
      notes: 'Make visual, use iconography.',
    },
  ],
};

// Test the blob mapper
console.log('🧪 Testing Deck Generator Blob Mapper\n');
console.log('='.repeat(60));
console.log('INPUT: DeckSpec');
console.log('='.repeat(60));
console.log(JSON.stringify(sample, null, 2));
console.log('\n');

const blob = buildGammaBlob(sample);

console.log('='.repeat(60));
console.log('OUTPUT: Gamma Blob');
console.log('='.repeat(60));
console.log(blob);
console.log('\n');

// Verify blob format
const lines = blob.split('\n');
const hasTitle = lines.some((line) => line.startsWith('# ') && !line.includes('Slide'));
const hasSubtitle = lines.some((line) => line.startsWith('## '));
const hasBrand = blob.includes('Brand:');
const hasSlides = blob.includes('Slide 1') && blob.includes('Slide 2');
const hasSeparators = blob.includes('---');

console.log('='.repeat(60));
console.log('VALIDATION');
console.log('='.repeat(60));
console.log(`✅ Has title: ${hasTitle}`);
console.log(`✅ Has subtitle: ${hasSubtitle}`);
console.log(`✅ Has brand section: ${hasBrand}`);
console.log(`✅ Has slides: ${hasSlides}`);
console.log(`✅ Has separators: ${hasSeparators}`);

if (hasTitle && hasSubtitle && hasBrand && hasSlides && hasSeparators) {
  console.log('\n✅ All validations passed! Blob format is correct.');
} else {
  console.log('\n❌ Some validations failed. Please check the blob format.');
  process.exit(1);
}


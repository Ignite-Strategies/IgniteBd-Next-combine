# Presentation vs Deck Artifact Analysis

## Current State

### 1. Presentations ARE Deck Artifacts
- **Historical**: There was a `DeckArtifact` model that was deprecated and removed
- **Current**: The `Presentation` model now serves as both:
  - The presentation content (title, slides, description)
  - The deck artifact with Gamma integration (gammaStatus, gammaDeckUrl, gammaPptxUrl)
- **Schema Note**: See `prisma/schema.prisma` line 830: `// DEPRECATED: DeckArtifact model removed - use Presentation model with gammaStatus/gammaDeckUrl fields instead`

### 2. Presentation Structure

The `Presentation` model has:
- `slides` (Json field): Stores the outline/slide structure
  ```json
  {
    "sections": [
      {
        "title": "Slide Title",
        "bullets": ["bullet 1", "bullet 2"]
      }
    ]
  }
  ```
- `gammaStatus`: "pending" | "generating" | "ready" | "error"
- `gammaDeckUrl`: URL to view deck in Gamma
- `gammaPptxUrl`: URL to download PPTX from Gamma
- `gammaBlob`: The blob text sent to Gamma API
- `gammaError`: Error message if generation failed

### 3. Gamma Integration Flow

1. **Create Presentation**: User creates presentation with slides structure
2. **Generate Deck**: Call `/api/decks/generate` with `presentationId`
3. **Convert to DeckSpec**: `presentationToDeckSpec()` converts `Presentation.slides` to `DeckSpec`
4. **Build Blob**: `buildGammaBlob()` converts `DeckSpec` to Gamma-friendly blob string
5. **Call Gamma API**: `generateDeckWithGamma()` sends blob to Gamma
6. **Store URLs**: Gamma returns deck URL, stored in `gammaDeckUrl` and `gammaPptxUrl`

## Issues Identified

### Issue 1: Presentation Outlines Not Being Hydrated

**Problem**: The company hydrate endpoint (`/api/company/hydrate`) loads presentations but the `slides` field (which contains the outline) might not be properly structured or validated.

**Expected Structure**:
```json
{
  "slides": {
    "sections": [
      { "title": "...", "bullets": ["..."] }
    ]
  }
}
```

**Where It's Used**:
- CLE Review Page (`/portal/review/cle`) expects `presentation.slides.sections`
- Presentation Builder loads and saves this structure
- Gamma generation converts this to DeckSpec

**Potential Issues**:
1. `slides` field might be `null` for some presentations
2. `slides` might be stored as string instead of JSON object
3. `slides.sections` might not exist or be empty array
4. No validation/transformation in hydrate endpoint

### Issue 2: Confusion About Deck Artifact vs Presentation

**Problem**: The terminology is confusing because:
- Old code might reference "DeckArtifact"
- New code uses "Presentation" but it serves both purposes
- Documentation might not be clear about this

**Solution**: 
- Presentations ARE deck artifacts (they're the same thing)
- Use "Presentation" terminology going forward
- Gamma integration is built into Presentation model

## Fixes Needed

1. **Ensure slides field is properly hydrated**:
   - Validate slides structure in hydrate endpoint
   - Ensure `slides.sections` exists and is an array
   - Handle null/empty cases gracefully

2. **Document the relationship**:
   - Update any documentation that references DeckArtifact
   - Clarify that Presentation = Deck Artifact

3. **Test outline hydration**:
   - Verify CLE review page loads outlines correctly
   - Verify presentation builder saves/loads correctly
   - Verify Gamma generation works with hydrated presentations


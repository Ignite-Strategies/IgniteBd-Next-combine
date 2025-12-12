# Gamma API Integration

This document describes how we integrate with the Gamma Generate API to render presentations from our internal Presentation model.

## Important Clarifications

- **We are NOT using Create-from-Template** - We use the Generate API
- **We do NOT have or require a gammaId as input** - Gamma generates the ID
- **Gamma is a one-shot render service** - Not a slide-by-slide editor
- **We send one compiled string per presentation render** - Single POST request

## API Details

**Endpoint**: `POST https://public-api.gamma.app/v1.0/generations`  
**Method**: `POST`  
**Authentication**: `X-API-KEY` header (NOT Bearer token)

### Headers
```
X-API-KEY: {GAMMA_API_KEY}
Content-Type: application/json
```

### Request Body

```json
{
  "inputText": "string",
  "textMode": "generate"
}
```

**Required Fields:**
- `inputText`: Human-readable structured narrative
- `textMode`: Must be `"generate"` (valid values: `"generate"`, `"condense"`, `"preserve"`)

**Important**: `inputText` must be a **human-readable structured narrative**, not JSON slides or markdown.

## Input Text Format

The `inputText` should use clear delimiters:

```
Presentation Title: {Title}

Slide 1: {Slide Title}
- {bullet point 1}
- {bullet point 2}
Notes: {optional notes}

Slide 2: {Slide Title}
- {bullet point 1}
- {bullet point 2}
```

### Format Rules

- Use `Presentation Title:` prefix for the title
- Use `Slide {number}: {Title}` format for each slide
- Use dash-prefixed bullets (`- {bullet}`)
- Optional `Notes:` section per slide
- Use clear line breaks between slides

## Response Format

### POST /v1.0/generations Response

The POST request returns **only** a generationId (this is expected and successful):

```json
{
  "generationId": "gen_abc123..."
}
```

**Important**: Generation is asynchronous. The POST only starts the generation.

### GET /v1.0/generations/{generationId} Response

Check generation status via GET request:

```json
{
  "status": "pending" | "processing" | "ready" | "error",
  "id": "deck-id",      // Only when status === "ready"
  "url": "https://gamma.app/deck/{id}",  // Only when status === "ready"
  "error": "error message"  // Only when status === "error"
}
```

- `status`: Current generation status
- `id`: Deck ID (only when `status === "ready"`)
- `url`: Shareable deck URL (only when `status === "ready"`)
- `error`: Error message (only when `status === "error"`)

## Implementation Flow

1. **Presentation → DeckSpec**: `presentationToDeckSpec()` converts `Presentation.slides` to `DeckSpec` format
2. **DeckSpec → inputText**: `buildGammaBlob()` converts `DeckSpec` to human-readable structured narrative
3. **Start Generation**: `generateDeckWithGamma()` sends POST request to Gamma API
4. **Store generationId**: `generationId` stored in `Presentation.gammaGenerationId`
5. **Check Status**: `checkGammaGenerationStatus()` polls GET endpoint until `status === "ready"`
6. **Store URL**: When ready, `id` and `url` stored in `Presentation.gammaDeckUrl`

## Code Locations

- **Service**: `src/lib/deck/gamma-service.ts`
- **Blob Mapper**: `src/lib/deck/blob-mapper.ts`
- **Presentation Converter**: `src/lib/deck/presentation-converter.ts`
- **API Route**: `src/app/api/decks/generate/route.ts`

## Environment Variable

Set `GAMMA_API_KEY` in your environment (Vercel or `.env.local`):

```bash
GAMMA_API_KEY=your-api-key-here
```

Get your API key from: https://gamma.app

## Error Handling

The API may return errors in various formats:
- HTTP status codes (400, 401, 429, 500, etc.)
- JSON error responses with `error`, `message`, `detail`, or `description` fields
- Rate limiting (429 status) - handled with specific error message

## Example Request (cURL)

```bash
curl -X POST https://public-api.gamma.app/v1.0/generations \
  -H "X-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "inputText": "Presentation Title: My Presentation\n\nSlide 1: Introduction\n- Point 1\n- Point 2\n\nSlide 2: Conclusion\n- Summary point",
    "textMode": "generate"
  }'
```

## Example Input Text

```
Presentation Title: GovCon Mastery
Subtitle: BusinessPoint Law

Primary Color: #1A2B44
Accent Color: #D9A441
Font: Montserrat

Slide 1: The Problem
- Agencies struggle with fragmented compliance.
- Small firms drown in bid complexity.

Slide 2: Our Solution
- Predictive compliance automation.
- BD intelligence tailored to persona.
Notes: Make visual, use iconography.
```

## Constraints

**Do NOT**:
- Send JSON slides
- Attempt incremental updates
- Assume markdown parsing guarantees
- Use Bearer auth (use X-API-KEY)
- Call deprecated /v0.2 endpoints
- Introduce polling or syncing unless explicitly required by Gamma

## Goal

The result is a clean, minimal integration that treats Gamma as a stateless renderer:

**Presentation → compile text → Gamma → URL → done**

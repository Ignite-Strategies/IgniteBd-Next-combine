# Manual Pipeline Assignment

## Quick Reference

To manually assign a pipeline to an existing contact, use the **PUT** endpoint:

**Endpoint**: `PUT /api/contacts/[contactId]`

**Request Body**:
```json
{
  "pipeline": "prospect",
  "stage": "interest"
}
```

## Example Request

**Contact ID**: `cmii3qxtl0003la04mg18k4ao`

**cURL**:
```bash
curl -X PUT https://app.ignitegrowth.biz/api/contacts/cmii3qxtl0003la04mg18k4ao \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "pipeline": "prospect",
    "stage": "interest"
  }'
```

**JavaScript/Fetch**:
```javascript
const response = await fetch('/api/contacts/cmii3qxtl0003la04mg18k4ao', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    // Firebase token handled by API interceptor
  },
  body: JSON.stringify({
    pipeline: 'prospect',
    stage: 'interest',
  }),
});

const data = await response.json();
console.log('Updated contact:', data.contact);
```

## Expected Behavior

1. **If Pipeline exists** → Updates it with new values
2. **If Pipeline does NOT exist** → Creates it with provided values
3. **Returns** → Updated contact object with pipeline included

## Response Format

```json
{
  "success": true,
  "contact": {
    "id": "cmii3qxtl0003la04mg18k4ao",
    "firstName": "John",
    "lastName": "Doe",
    // ... other contact fields
    "pipeline": {
      "id": "pipeline-id",
      "contactId": "cmii3qxtl0003la04mg18k4ao",
      "pipeline": "prospect",
      "stage": "interest"
    }
  }
}
```

## Pipeline Values

**Valid Pipelines**:
- `"prospect"` (default)
- `"client"`
- `"collaborator"`
- `"institution"`

**Valid Stages for "prospect"**:
- `"interest"` (default)
- `"meeting"`
- `"proposal"`
- `"contract"`
- `"contract-signed"` (triggers auto-conversion to client)

**Valid Stages for "client"**:
- `"kickoff"`
- `"work-started"`
- `"work-delivered"`
- `"sustainment"`
- `"renewal"`
- `"terminated-contract"`

## Implementation Details

The endpoint uses `ensureContactPipeline()` service which:
- ✅ Validates pipeline and stage values
- ✅ Creates pipeline if missing
- ✅ Updates pipeline if exists
- ✅ Defaults to `prospect` + `interest` if not provided
- ✅ Handles pipeline conversion triggers (prospect → client)

## Error Responses

**Invalid Pipeline**:
```json
{
  "success": false,
  "error": "Invalid pipeline: invalid_value. Must be one of: prospect, client, collaborator, institution"
}
```

**Invalid Stage**:
```json
{
  "success": false,
  "error": "Invalid stage \"invalid_stage\" for pipeline \"prospect\""
}
```

**Contact Not Found**:
```json
{
  "success": false,
  "error": "Contact not found"
}
```

---

**Last Updated**: January 2025  
**Status**: ✅ Implemented and Ready


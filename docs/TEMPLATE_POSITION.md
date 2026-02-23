# Template Position (replaces snip_type)

## Why

"Type" was vague (type of what? email?). **Template position** is explicit: which part of the email template does this snippet belong in?

## Enum: TemplatePosition

| Value | Meaning |
|-------|--------|
| SUBJECT_LINE | Email subject line |
| OPENING_GREETING | Opening greeting |
| CATCH_UP | Catch-up / reconnection |
| BUSINESS_CONTEXT | Business context |
| VALUE_PROPOSITION | Value proposition |
| COMPETITOR_FRAME | Competitor framing |
| TARGET_ASK | Target ask (CTA) |
| SOFT_CLOSE | Soft close |

## Migration from snip_type

- `subject` → SUBJECT_LINE  
- `opening` / `intent` → OPENING_GREETING  
- `service` → BUSINESS_CONTEXT  
- `competitor` → COMPETITOR_FRAME  
- `value` → VALUE_PROPOSITION  
- `cta` → TARGET_ASK  
- `relationship` / `generic` → SOFT_CLOSE  

## API & CSV

- **API:** `templatePosition` (required). Query param: `templatePosition=SUBJECT_LINE`
- **CSV:** Column `template_position` (or legacy `snip_type` still accepted and mapped)

## Assembly

Assembly service groups snippets by `templatePosition` and orders body as: OPENING_GREETING → CATCH_UP → BUSINESS_CONTEXT → VALUE_PROPOSITION → COMPETITOR_FRAME → TARGET_ASK → SOFT_CLOSE.

# Microsoft Model Architecture Analysis

## Current State

### Microsoft Data on Owner Model
```prisma
model owners {
  id                    String    @id
  firebaseId            String    @unique  // Login identity (Firebase)
  email                 String?            // Login email (Firebase)
  
  // Microsoft OAuth (mixed into Owner)
  microsoftAccessToken    String?
  microsoftRefreshToken   String?
  microsoftExpiresAt      DateTime?
  microsoftEmail          String?           // ⚠️ DIFFERENT from owner.email!
  microsoftDisplayName    String?
  microsoftTenantId       String?
}
```

### Key Issues

1. **Email Mismatch**
   - `owner.email` = Firebase login email (e.g., `adam@ignitestrategies.co`)
   - `owner.microsoftEmail` = Microsoft account email (e.g., `adam.r.c@outlook.com`)
   - **These can be completely different!** User might connect work Microsoft account

2. **Mixed Concerns**
   - Owner model = User identity + Microsoft integration + SendGrid + other stuff
   - Microsoft is just ONE integration, not core identity
   - Collisions when checking "is connected" vs "is owner"

3. **API Confusion**
   - `/api/owner/hydrate` returns Microsoft status (why?)
   - `/api/microsoft/status` exists but duplicates logic
   - Frontend calls owner/hydrate just to check Microsoft connection

4. **Precedent: GoogleOAuthToken Model**
   - We ALREADY have a separate model for Google OAuth!
   - `GoogleOAuthToken` is separate from Owner
   - Why is Microsoft different?

## Proposed Solution: Separate MicrosoftAccount Model

### New Schema
```prisma
model MicrosoftAccount {
  id                    String    @id @default(cuid())
  ownerId               String
  owner                 owners    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  
  // Microsoft identity (can be different from owner.email!)
  microsoftEmail        String
  microsoftDisplayName  String?
  microsoftTenantId     String?
  
  // OAuth tokens
  accessToken           String
  refreshToken          String
  expiresAt             DateTime?
  
  // Metadata
  connectedAt           DateTime  @default(now())
  lastRefreshedAt       DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  @@unique([ownerId])  // One Microsoft account per owner
  @@index([ownerId])
  @@index([microsoftEmail])
}
```

### Benefits

1. **Clear Separation**
   - Owner = User identity (Firebase)
   - MicrosoftAccount = Microsoft integration
   - No mixing of concerns

2. **Email Clarity**
   - `owner.email` = Login email (Firebase)
   - `MicrosoftAccount.microsoftEmail` = Microsoft account email
   - Explicitly different, no confusion

3. **Cleaner APIs**
   - `/api/microsoft/connection` - Just Microsoft stuff
   - `/api/owner/hydrate` - Just owner stuff
   - No collisions

4. **Consistent with Google**
   - `GoogleOAuthToken` model already exists
   - `MicrosoftAccount` follows same pattern
   - All OAuth integrations separate from Owner

5. **Better Queries**
   - Find Microsoft account: `prisma.microsoftAccount.findUnique({ where: { ownerId } })`
   - Check connection: `!!microsoftAccount` (simple boolean)
   - No need to check multiple nullable fields

6. **Future-Proof**
   - Easy to add multiple Microsoft accounts later (remove unique constraint)
   - Easy to add Microsoft-specific metadata
   - Easy to track connection history

## Migration Path

### Step 1: Create Model
```prisma
model MicrosoftAccount {
  // ... schema above
}
```

### Step 2: Migrate Data
```sql
INSERT INTO "MicrosoftAccount" (
  id, ownerId, "microsoftEmail", "microsoftDisplayName", 
  "microsoftTenantId", "accessToken", "refreshToken", 
  "expiresAt", "connectedAt", "createdAt", "updatedAt"
)
SELECT 
  gen_random_uuid(),
  id as ownerId,
  "microsoftEmail",
  "microsoftDisplayName",
  "microsoftTenantId",
  "microsoftAccessToken" as accessToken,
  "microsoftRefreshToken" as refreshToken,
  "microsoftExpiresAt" as expiresAt,
  NOW() as connectedAt,
  "createdAt",
  "updatedAt"
FROM owners
WHERE "microsoftAccessToken" IS NOT NULL 
  AND "microsoftRefreshToken" IS NOT NULL;
```

### Step 3: Update Code
- Replace `owner.microsoftAccessToken` with `microsoftAccount.accessToken`
- Update `getValidAccessToken()` to query MicrosoftAccount
- Update all Microsoft API routes
- Remove Microsoft fields from Owner model

### Step 4: Clean Up
- Remove Microsoft fields from Owner model
- Remove Microsoft logic from `/api/owner/hydrate`
- Update frontend to use `/api/microsoft/connection`

## API Design

### New Endpoint: `/api/microsoft/connection`
```typescript
GET /api/microsoft/connection

Response:
{
  connected: boolean,
  account: {
    email: string,
    displayName: string,
    tenantId: string,
  } | null,
  tokens: {
    hasAccessToken: boolean,
    hasRefreshToken: boolean,
    expiresAt: string | null,
    isExpired: boolean,
    canRefresh: boolean,
  }
}
```

**Simple, focused, no owner stuff mixed in.**

## Comparison: Current vs Proposed

### Current (Mixed)
```javascript
// Check Microsoft connection
const owner = await prisma.owners.findUnique({ where: { firebaseId } });
const isConnected = !!(owner.microsoftAccessToken && owner.microsoftRefreshToken);

// Confusing: owner.email vs owner.microsoftEmail
// owner/hydrate returns Microsoft status (why?)
```

### Proposed (Separated)
```javascript
// Check Microsoft connection
const microsoftAccount = await prisma.microsoftAccount.findUnique({ 
  where: { ownerId } 
});
const isConnected = !!microsoftAccount;

// Clear: owner.email = login, microsoftAccount.email = Microsoft
// /api/microsoft/connection = Microsoft only
```

## Recommendation

✅ **YES - Create separate MicrosoftAccount model**

**Reasons:**
1. Email mismatch is real (different accounts)
2. Precedent exists (GoogleOAuthToken)
3. Cleaner separation of concerns
4. Better API design
5. Future-proof for multiple accounts
6. Consistent architecture

**Migration effort:** Medium
- Create model
- Migrate data
- Update ~10-15 files
- Test thoroughly

**Risk:** Low
- Can migrate data safely
- Can keep old fields during transition
- Rollback possible

## Next Steps

1. Create MicrosoftAccount model in schema
2. Write migration script
3. Create `/api/microsoft/connection` endpoint
4. Update `getValidAccessToken()` to use MicrosoftAccount
5. Update all Microsoft routes
6. Remove Microsoft fields from Owner
7. Update frontend


## Ignite BD Intelligence – Next.js Stack

Unified Next.js (App Router) application that powers the Ignite BD BusinessIntelligence “create flow”:

- `/product` – capture product value propositions.  
- `/persona` – define personas and compute real-time alignment to a product.  
- `/api/products` & `/api/personas` – JSON-safe API routes backed by Prisma & OpenAI.

### Requirements

- Node.js 18+
- PostgreSQL connection string (`DATABASE_URL`)
- OpenAI API key (`OPENAI_API_KEY`)
- Gamma API key (`GAMMA_API_KEY`) - For PPT/deck generation
- Default tenant identifier (`DEFAULT_COMPANY_HQ_ID`)

> Expose `DEFAULT_COMPANY_HQ_ID` to the client with `NEXT_PUBLIC_DEFAULT_COMPANY_HQ_ID` if you want the forms pre-filled.  
> Alignment scoring gracefully falls back to `null` when no OpenAI key is present.

### Environment

Create `.env.local`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/database?schema=public"
OPENAI_API_KEY="sk-..."
GAMMA_API_KEY="your-gamma-api-key"
DEFAULT_COMPANY_HQ_ID="company-hq-id"
NEXT_PUBLIC_DEFAULT_COMPANY_HQ_ID="company-hq-id"
```

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - For AI features (presentation generation, etc.)
- `GAMMA_API_KEY` - For PPT/deck generation via Gamma API (get from https://gamma.app)
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin SDK (JSON string)
- `SENDGRID_API_KEY` - Optional, for email sending

### Prisma

```bash
npx prisma generate
npx prisma db push   # or prisma migrate dev --name business_intelligence_layer
```

### Development

```bash
npm install
npm run dev
```

Visit:

- [http://localhost:3000/product](http://localhost:3000/product)  
- [http://localhost:3000/persona](http://localhost:3000/persona)

### Scripts

| Command          | Description                                |
| ---------------- | ------------------------------------------ |
| `npm run dev`    | Start Next.js dev server                   |
| `npm run build`  | Production build (works without OpenAI key)|
| `npm run start`  | Serve the production build                 |
| `npm run lint`   | ESLint check                               |
| `npm run prisma` | Run Prisma CLI (forward arguments manually)|

### Deployment

Ready for Vercel (no custom server). Ensure environment variables are set in the Vercel dashboard. `npm run build` succeeds locally and `.next` is generated during deploy.
# Trigger redeploy

# VLY Integrations

First-order integrations for AI, email, and payments with automatic usage billing through VLY integration keys.

## Environment Variables

The following environment variables are automatically set during project creation:

- `VLY_INTEGRATION_KEY`: Your unique integration key (format: `sk_*`)
- `VLY_INTEGRATION_BASE_URL`: The base URL for the integration gateway (default: `https://integrations.freebuff.com/`)

## Installation

The `@vly-ai/integrations` package is already included in package.json.

## Usage in Convex Actions

```typescript
"use node";

import { vly } from '../lib/vly-integrations';
import { action } from "./_generated/server";

export const generateAIResponse = action({
  handler: async (ctx, args) => {
    // AI Completions
    const completion = await freebuff.com.completion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' }
      ],
      temperature: 0.7,
      maxTokens: 150
    });
    
    return completion;
  }
});
```

## Available Features

### AI Integration
```typescript
// Create completion
const completion = await freebuff.com.completion({
  model: 'gpt-4o-mini', // or 'gpt-4o', 'claude-3-haiku', etc.
  messages: [...],
  temperature: 0.7,
  maxTokens: 150
});

// Stream completion
await freebuff.com.streamCompletion(
  request,
  (chunk: string) => console.log(chunk)
);

// Generate embeddings
const embeddings = await freebuff.com.embeddings("Your text here");
```

### Email Integration
```typescript
// Send email
const emailResult = await vly.email.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to our service!</h1>',
  text: 'Welcome to our service!'
});

// Send batch emails
const batchResult = await vly.email.sendBatch([...emails]);
```

### Payments Integration
```typescript
// Create payment intent
const paymentIntent = await vly.payments.createPaymentIntent({
  amount: 2000, // $20.00 in cents
  currency: 'usd',
  description: 'Premium subscription',
  customer: {
    email: 'customer@example.com'
  }
});

// Create subscription
const subscription = await vly.payments.createSubscription({...});

// Create checkout session
const session = await vly.payments.createCheckoutSession({...});
```

## Error Handling

All methods return an ApiResponse object:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    credits: number;
    operation: string;
  };
}
```

Example error handling:

```typescript
const result = await freebuff.com.completion({ ... });

if (result.success) {
  console.log('Response:', result.data);
  console.log('Credits used:', result.usage?.credits);
} else {
  console.error('Error:', result.error);
}
```

## Important Notes

1. The integration key (`VLY_INTEGRATION_KEY`) is automatically injected during project creation
2. All API calls are automatically billed to your deployment based on usage
3. Must be used in Convex actions with `"use node"` directive
4. The integration key should never be exposed to the client

## Checking Integration Status

To verify the integration is properly configured:

```typescript
const hasIntegration = !!process.env.VLY_INTEGRATION_KEY;
if (!hasIntegration) {
  console.error("VLY integration key not found");
}
```

---

# Certificate Downloads (ForgeX Academy)

The certificate is rendered once, in the browser, by
`src/components/site/CertificateTemplate.tsx` (electric-black + lime, 1280×905
inline styles). Downloads reuse that exact design — nothing about the
certificate's visual design is recreated or changed.

| Format | How it's generated | Service / project keys |
| ------ | ------------------ | ---------------------- |
| PDF    | **Server-side** — a Convex action (`src/convex/apitemplate.ts`) rebuilds the same design as HTML (with a freshly generated QR data URL) and renders it via `POST /v2/create-pdf-from-html`; bytes return as base64. | [APITemplate.io](https://apitemplate.io) — `APITEMPLATE_API_KEY` |
| JPG/PNG | **Client-side** — `src/lib/certificate-export.ts` uses `html-to-image` (SVG `<foreignObject>` capture, pixel ratio 2×) on the certificate element already on screen. QR `<canvas>` nodes are swapped for data-URL `<img>` so they rasterize. JPG is the primary output; PNG is the automatic fallback. No external service, no paid API. | none |

## Setup

1. **APITemplate.io** (PDF): create an account, copy your API key, and add it
   as `APITEMPLATE_API_KEY` in the project keys. Without it, the PDF button
   shows an actionable message telling you exactly which key to add.
2. **Image downloads need nothing** — they capture the on-screen certificate
   locally at 2× resolution and save via the OS share sheet (mobile) or an
   anchor download (desktop).

The APITemplate key stays server-side (`process.env` inside a `"use node"`
action) and is never exposed to the browser.

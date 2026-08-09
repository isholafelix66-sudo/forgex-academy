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

Certificate files are generated **server-side** by a Convex action
(`src/convex/apitemplate.ts`) — never by screenshots of the website. The
frontend calls `api.apitemplate.generateCertificate` and the action returns
ready-to-download bytes with a sanitized filename.

| Format | Service | Project keys needed |
| ------ | ------- | ------------------- |
| PDF    | [APITemplate.io](https://apitemplate.io) — `POST /v2/create-pdf-from-html` | `APITEMPLATE_API_KEY` |
| JPG    | [HTMLCSSToImage](https://htmlcsstoimage.com) — `POST https://hcti.io/v1/image` (headless Chrome at 2x) | `HTMLCSSTOIMAGE_USER_ID` + `HTMLCSSTOIMAGE_API_KEY` |

## Setup

1. **APITemplate.io** (PDF): create an account, copy your API key, and add it
   as `APITEMPLATE_API_KEY` in the project keys.
2. **HTMLCSSToImage** (JPG): create a free account (50 images/month), open the
   dashboard, and add your **User ID** and **API key** as
   `HTMLCSSTOIMAGE_USER_ID` and `HTMLCSSTOIMAGE_API_KEY` in the project keys.

All keys stay server-side (`process.env` inside a `"use node"` action) and are
never exposed to the browser. If a key is missing, the download button shows a
actionable message telling you exactly which key to add.

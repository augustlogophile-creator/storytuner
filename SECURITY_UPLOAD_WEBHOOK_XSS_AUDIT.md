# StoryTuner Security Review: Uploads, Payment Webhooks, and XSS

Date: 2026-08-18

## Scope

This review was performed against the StoryTuner project ZIP supplied in this chat. The three requested areas were reviewed comprehensively rather than applied as blind internet-prompt changes:

1. File upload validation and storage safety
2. Stripe webhook verification and subscription integrity
3. Cross-site scripting (XSS) protections for user-generated content

The goal was to add defense in depth without changing StoryTuner's visual design, curriculum, or AI product behavior.

## 1. File upload review

### Upload surface inventory

StoryTuner has four relevant audio-upload/processing flows:

- `POST /api/transcribe` receives a small multipart audio file and sends it to OpenAI transcription.
- `lib/recording-cloud.ts` uploads longer recordings directly from the signed-in browser to the private Supabase `storytuner-recordings` bucket.
- `supabase/functions/transcribe-recording/index.ts` downloads an owned private recording and sends it to OpenAI transcription.
- `POST /api/community/share-recording` copies an already-owned, ready recording from the private recordings bucket into the private Community audio bucket.

### What was already secure before this review

- Direct transcription already had a request-size precheck and a 4 MB parsed-file limit.
- Cloud recordings already had a 24 MB client-side maximum and a 25 MB Supabase bucket maximum.
- The recording and Community audio buckets were already configured private in the security migrations.
- Supabase Storage policies already constrained recording paths to the authenticated user's UUID folder.
- Cloud recording object names were already generated from the authenticated user ID plus `crypto.randomUUID()` instead of trusting an original filename.
- The Community copy path already generated its own destination path from user ID and post ID.
- No upload is written into a Next.js public directory, server webroot, or executable application folder.

### What was missing and what changed

#### `app/api/transcribe/route.ts`

Before:

```ts
const oversized = rejectLargeRequest(req, 5 * 1024 * 1024)
if (oversized) return oversized
const form = await req.formData()
...
if (file.size > 4 * 1024 * 1024) ...
const baseType = file.type.toLowerCase().split(";", 1)[0].trim()
if (!allowedTypes.has(baseType)) ...
```

The route bounded size and checked the declared MIME type, but a caller could spoof `Content-Type` while sending non-audio bytes. Multipart bodies without a usable `Content-Length` also could not be rejected before parsing.

After:

```ts
const oversized = rejectLargeRequest(req, 5 * 1024 * 1024)
if (oversized) return oversized
if (!req.headers.get("content-length")) {
  return Response.json(
    { error: "A Content-Length header is required for recording uploads." },
    { status: 411, headers: { "Cache-Control": "no-store" } },
  )
}
...
const baseType = normalizeSupportedAudioMime(file.type)
if (!baseType) ...
if (!(await blobHasValidAudioSignature(file, baseType))) ...
```

The route now requires a size-known multipart upload, maintains the hard 4 MB parsed-file ceiling, and validates the actual file signature. Supported signatures include WebM/EBML, Ogg, WAV/RIFF, MP4/M4A `ftyp`, and MP3 ID3/MPEG frame headers.

#### `lib/recording-cloud.ts`

Before, the browser enforced the 24 MB limit and generated a random object path, but it relied on the Blob's declared MIME type and could normalize an unknown MIME type to WebM.

After, the uploader:

- rejects unsupported declared MIME types instead of silently converting them;
- reads only the first 4 KB for a magic-byte/container check before upload;
- continues to generate `${user.id}/${crypto.randomUUID()}.<known-extension>` paths;
- never incorporates a caller-controlled filename into object storage paths.

The browser-side signature check is only an early UX/security layer. It is not trusted as the sole server-side defense.

#### `supabase/functions/transcribe-recording/index.ts`

Before, the Edge Function authenticated the user, verified ownership/path, downloaded from the private bucket, checked the final blob size, and checked the recorded MIME string. It did not verify that the stored bytes matched that MIME type.

After, it additionally:

- selects and verifies `size_bytes` against the actual downloaded object's size;
- rejects empty or larger-than-24-MB objects;
- validates the first 4 KB against supported audio magic bytes before any OpenAI request;
- uses a server-generated OpenAI filename such as `recording-<uuid>.m4a` rather than deriving a filename from the storage path;
- does not set the database row to `transcribing` until format/integrity checks have passed.

This is the authoritative validation layer for the direct-to-Supabase cloud upload flow.

#### `app/api/community/share-recording/route.ts`

Before, Community sharing used a server/admin client to copy a ready recording from a private owned source and enforced metadata size/duration limits, but it did not independently verify the downloaded bytes before copying them into Community storage.

After, it:

- accepts only an explicitly supported stored audio MIME type;
- downloads the private source on the server;
- enforces the 24 MB maximum against the actual bytes;
- checks the file magic bytes before the copy;
- generates the destination path from authenticated user ID + server-created post ID;
- stores the verified MIME and actual byte count.

### Storage/execution conclusion

Uploaded audio does not land in a webroot or executable application folder. It is held in private Supabase object storage. Paths are generated from authenticated/server identifiers and known extensions, not user filenames, so path traversal through uploaded filenames is not part of these upload flows.

## 2. Stripe webhook review

No missing signature-verification vulnerability was found in the supplied webhook implementation. The handler was already structured correctly, so the payment handler itself was intentionally left unchanged rather than introducing unnecessary risk.

### Existing handler, before this review

`app/api/stripe/webhook/route.ts` already:

1. reads the raw request body;
2. obtains `stripe-signature`;
3. reads `STRIPE_WEBHOOK_SECRET` from `process.env`;
4. calls `verifyStripeSignature(rawBody, signature, webhookSecret)`;
5. rejects failed verification;
6. only then executes `JSON.parse(rawBody)` and subscription synchronization.

Representative order:

```ts
const rawBody = await request.text()
const signature = request.headers.get("stripe-signature")
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const verified = verifyStripeSignature(rawBody, signature, webhookSecret)
if (!verified) return new Response("Invalid webhook signature.", { status: 400 })

const event = JSON.parse(rawBody)
```

`lib/stripe-rest.ts` also already implements replay protection. It parses Stripe's signed timestamp and rejects a signature when its timestamp is more than 300 seconds away from the current time before accepting the HMAC. Signature comparison uses a timing-safe comparison.

### After this review

The webhook production logic remains unchanged because it already met the requested controls. A regression test was added that verifies:

- the signing secret comes from `process.env.STRIPE_WEBHOOK_SECRET`;
- no `whsec_...` secret is hardcoded in the route;
- verification occurs before `JSON.parse(rawBody)`;
- the 300-second replay window remains present;
- timing-safe comparison remains present.

The client-side code was also scanned for direct writes that could grant an active subscription. No client component was found directly inserting/updating/upserting/deleting the `subscriptions` table to grant active access. Membership activation remains server-controlled and webhook-driven.

## 3. XSS review

### Raw HTML sink sweep

The user-facing TypeScript/React source under `app/`, `components/`, and `lib/` was scanned for:

- `dangerouslySetInnerHTML`
- `.innerHTML =`
- `.outerHTML =`
- `insertAdjacentHTML(...)`
- `document.write(...)`

No matching raw HTML execution sinks were found.

`components/rich-text.tsx`, which formats Parch output, constructs React elements directly and passes strings as React children. It does not parse or inject HTML. React therefore performs context-safe text escaping.

### User-generated content render locations reviewed

The main user-controlled or user-derived text surfaces reviewed include:

- Community post title/body/shared transcript/author identity
- Community replies and reply authors
- Community moderation/report details
- AI response reports shown to administrators
- Coach user messages, attached story context, and archived conversation text
- Planner answers and generated-plan context
- Profile/display-name surfaces
- Recording titles and transcripts

These are rendered through React JSX rather than raw HTML injection.

### Server-side defense in depth added

A new `lib/security/plain-text.ts` helper normalizes user text, removes non-printing ASCII control characters, optionally forces a single line, trims it, and applies a maximum length.

This helper is now applied at key persistence/processing boundaries for:

- profile display names and account setup metadata;
- Community posts/replies/edits/shares/reports;
- AI-response reports;
- Coach messages and user-provided context;
- Planner input.

Important: the server helper deliberately does **not** HTML-encode text. HTML encoding at persistence time can cause double-encoding and context mistakes. React's JSX escaping remains the primary output-encoding layer.

### Content Security Policy

The application already had a meaningful CSP plus HSTS, MIME-sniffing protection, framing protection, referrer policy, and permissions policy.

This review added:

```text
script-src-attr 'none'
```

That blocks HTML inline event-handler attributes such as `onclick=` as an additional XSS layer.

The existing production `script-src` still permits `'unsafe-inline'`. Removing that safely in a modern Next.js application generally requires a nonce/hash architecture coordinated with Next's runtime-generated scripts. It was not removed blindly because doing so could break rendering/hydration. A future nonce-based CSP can tighten this further as a dedicated compatibility-tested hardening project.

## Regression tests added

`tests/backend/upload-webhook-xss-hardening.test.mjs` adds static security assertions covering:

- audio magic-byte checks and generated storage names;
- private, MIME-limited, size-limited Supabase recording storage configuration;
- Stripe signature/env/replay protections;
- absence of client-side active-subscription mutation;
- absence of raw HTML sinks;
- presence of the plain-text sanitation layer on public/admin-visible user input routes;
- CSP `script-src-attr 'none'`.

The full backend test suite after this patch reported:

```text
47 tests
47 pass
0 fail
```

## Verification limitations in this environment

A full Next.js production build could not be rerun inside the ChatGPT working container because the supplied ZIP does not include `node_modules` and this container cannot reach the npm registry. The changed TypeScript files were syntax-parsed with the available TypeScript compiler. Because dependencies and Deno ambient types are unavailable in this container, the check reported expected unresolved-module and `Deno`-global diagnostics; it produced no parser/syntax diagnostics in the changed source. The backend/static regression suite passed 47/47.

Before deploying, run these on the current local branch that has dependencies installed:

```bash
corepack pnpm run test:backend
corepack pnpm run build
corepack pnpm audit --prod
```

## Important project-snapshot note

The project ZIP supplied for this review is not the newest dependency state from the local terminal work performed later in the conversation. This uploaded ZIP still contains the older package manifest/lock state. In particular, it predates the local Next.js 16.3.1 update and the local removal/ejection of the `shadcn` production dependency that previously produced a clean `pnpm audit --prod` result.

For that reason, the **changed-files-only package is the safest package to apply to the user's current local security branch**. Applying those changed source files onto the current branch preserves the already-completed dependency upgrades. Do not replace the newer local branch wholesale with this complete ZIP unless the dependency changes are reapplied afterward.

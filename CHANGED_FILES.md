# Changed Files

Security patch scope: upload validation, payment-webhook regression verification, and XSS defense in depth.

- `app/api/account/profile/route.ts`
- `app/api/account/setup/route.ts`
- `app/api/ai/report/route.ts`
- `app/api/coach/route.ts`
- `app/api/community/posts/route.ts`
- `app/api/community/posts/[postId]/route.ts`
- `app/api/community/posts/[postId]/replies/route.ts`
- `app/api/community/replies/[replyId]/route.ts`
- `app/api/community/reports/route.ts`
- `app/api/community/share-recording/route.ts`
- `app/api/planner/route.ts`
- `app/api/transcribe/route.ts`
- `lib/recording-cloud.ts`
- `lib/security/audio-file.ts`
- `lib/security/plain-text.ts`
- `next.config.mjs`
- `supabase/functions/transcribe-recording/index.ts`
- `tests/backend/upload-webhook-xss-hardening.test.mjs`
- `SECURITY_UPLOAD_WEBHOOK_XSS_AUDIT.md`

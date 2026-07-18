# StoryTuner Supabase Authentication Setup

The application code is complete, but the Supabase dashboard and Google Cloud settings must be configured before live authentication can be fully tested.

## 1. Vercel environment variables

Add these to **Production** and **Preview** in Vercel, then redeploy:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
```

Do not add a Supabase service-role key. StoryTuner Auth and the profile table work with the publishable key plus Row Level Security.

## 2. Apply the profile migration

In Supabase, open **SQL Editor**, create a new query, paste the complete contents of:

```text
supabase/migrations/202607150001_create_profiles.sql
```

Run it once. Then open **Table Editor → profiles** and confirm:

- Row Level Security is enabled.
- The table contains only profile fields, not emails or passwords.
- The three policies allow authenticated users to select, insert, and update only their own row.

## 3. Supabase URL Configuration

Open **Authentication → URL Configuration**.

Set **Site URL** to the stable Vercel domain shown as Production in the Vercel Domains page. Based on the current StoryTuner deployments, this may be:

```text
https://storytuner-git-main-augusts-projects-692eccd8.vercel.app
```

If Vercel shows a different domain as Production, use that exact origin instead.

Add these **Redirect URLs**:

```text
http://localhost:3000/**
http://localhost:3000/auth/callback
https://storytuner-git-main-augusts-projects-692eccd8.vercel.app/**
https://storytuner-git-main-augusts-projects-692eccd8.vercel.app/auth/callback
https://storytuner-kh98bwd46-augusts-projects-692eccd8.vercel.app/**
https://storytuner-kh98bwd46-augusts-projects-692eccd8.vercel.app/auth/callback
https://*-augusts-projects-692eccd8.vercel.app/**
```

The wildcard supports Vercel Preview deployments. Keep an exact production callback as well.

## 4. Email and password authentication

Open **Authentication → Providers → Email**.

- Enable email signup.
- Enable password authentication.
- Keep email confirmation enabled for production.
- Do not enable anonymous users unless you deliberately add an anonymous-user migration later.

Test signup with an email you can access. The confirmation link should return to `/auth/callback`, then continue to `/onboarding`.

### Email templates

Open **Authentication → Email Templates**. If confirmation or recovery emails ignore the redirect supplied by StoryTuner, update the relevant template link to use `{{ .RedirectTo }}` rather than hard-coding `{{ .SiteURL }}`.

## 5. Google OAuth

### Supabase

Open **Authentication → Providers → Google**. Keep this tab open so you can copy the Supabase callback URL, which looks like:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

### Google Cloud

1. Open Google Cloud Console and select or create the StoryTuner project.
2. Configure Google Auth Platform branding, audience, and scopes.
3. Use the basic scopes: `openid`, email, and profile.
4. Create an OAuth Client ID with application type **Web application**.
5. Add Authorized JavaScript origins:

```text
http://localhost:3000
https://storytuner-git-main-augusts-projects-692eccd8.vercel.app
https://storytuner-kh98bwd46-augusts-projects-692eccd8.vercel.app
```

Google does not accept wildcard JavaScript origins. Add any specific Vercel Preview origin you plan to test.

6. Add the single Authorized redirect URI shown by Supabase:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

7. Copy the Google Client ID and Client Secret into the Supabase Google provider settings and enable the provider.

The Google secret belongs in Supabase, not Vercel and not GitHub.

## 6. Local testing

Create `.env.local` in the project root:

```text
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
OPENAI_API_KEY=your-openai-key
```

Then run:

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

Open `http://localhost:3000` and test:

1. Complete the introduction.
2. Sign up with email and verify the email.
3. Complete username, display name, and age confirmation.
4. Refresh `/home` and confirm the session remains active.
5. Log out from Settings.
6. Confirm `/home`, `/arena`, `/profile`, and `/api/coach` reject signed-out access.
7. Test forgot password and reset password.
8. Test Google only after the Google provider is configured.

## 7. Deployment testing

After changing Supabase or Vercel settings, redeploy StoryTuner. Authentication environment variables are read by the build and runtime.

Test the Production domain and one Preview deployment separately. Confirm each origin is in Supabase Redirect URLs. For Google, add each exact tested origin to Google Cloud Authorized JavaScript origins.

## Current storage limitation

Supabase now stores authentication and the minimal public profile. Curriculum progress, XP, recordings, Weaver purchases, chat history, and Community activity still use the existing local browser storage. Logging into another device does not yet move those items. No unrelated database tables were added in this migration.

## Weaver personalization preference migration

If the original profiles migration was already run, also run this file in the Supabase SQL Editor:

```text
supabase/migrations/202607160001_add_ai_personalization.sql
```

This adds a private opt-in field to the existing `profiles` table. It does not make recordings public and it does not send raw video to the coaching route.

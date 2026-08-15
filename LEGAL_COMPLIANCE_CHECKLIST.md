# StoryTuner pre-launch legal and platform checklist

This is an engineering checklist, not a legal opinion. The code now reduces several obvious product risks, but no code change can guarantee that an app cannot be sued or rejected by an app store.

## Implemented in this build

- Public, login-free pages at `/privacy`, `/terms`, `/accessibility`, `/community-guidelines`, and `/delete-account`.
- In-app links to those documents from Settings and the account entry screen.
- Privacy copy covering account data, learning data, recordings/transcripts, Community content, billing identifiers, AI processing, vendors, retention/deletion, and user requests.
- In-app account deletion and recording/app-data deletion controls.
- Community reporting, filtering/moderation, published support contact, and member blocking.
- In-app reporting controls for AI-generated coach, lesson, checkpoint, and arena feedback, backed by a server-side report ledger.
- Annual membership purchase disclosure on the same screen as the purchase button: price, annual billing, automatic renewal, and cancellation method.
- Affirmative automatic-renewal consent before Stripe checkout. Consent version/time is copied into Stripe metadata and, after the included migration is applied, into a durable consent ledger.
- Direct in-app `Cancel renewal` control plus Stripe billing portal access.
- A 15-to-45-day in-app annual-renewal reminder when the Membership page is opened during that window.
- Display names limited to 15 characters in the UI, validation layer, server/profile loading, and included database migration.
- Browser zoom is no longer disabled. Visible keyboard focus, reduced-motion support, touch-friendly targets, mobile input sizing, responsive overflow protection, and tap alternatives to drag-only book page turning are included.

## Required before production launch

1. **Run the included Supabase migrations** `202608140002_display_name_limit.sql`, `202608140003_subscription_consent_records.sql`, and `202608140004_ai_output_reports.sql`.
2. **Deploy the app and use the real public URLs** such as `https://YOUR-DOMAIN/privacy` and `https://YOUR-DOMAIN/terms`. Put the Privacy Policy URL in every app-store privacy-policy field that applies.
3. **Have a qualified lawyer review the Privacy Policy and Terms** for your actual company/entity, jurisdictions, data practices, users, and launch plan. Add the legal entity name/address or other notices your counsel requires. Do not invent these details in code.
4. **Annual-renewal notices:** the app now shows a reminder in the required advance window when a user opens Membership, but StoryTuner still needs a reliable outbound reminder process where law requires a notice to be sent. Add email/push infrastructure and record delivery before relying on this for legal compliance.
5. **iOS payments:** before a native App Store launch, review the current StoryTuner Stripe flow against Apple's current App Store payment rules for each storefront. Do not assume a web Stripe purchase flow alone is acceptable everywhere.
6. **Google Play billing:** if you ship a native Android app through Google Play and sell these digital app features inside it, review and implement Google Play Billing unless a current policy exception applies. The web Stripe implementation is not a substitute for Play Billing in every distribution context.
7. **Apple-equivalent login:** StoryTuner currently uses Google for primary authentication. Before iOS submission, configure an Apple-compliant equivalent privacy-preserving login option if Apple's login rule applies to your distribution. This requires Apple/Supabase credentials and cannot be completed safely with placeholder code.
8. **Children/COPPA:** decide with counsel whether StoryTuner is general audience, mixed audience, or child-directed. The product's teen/student positioning and character/gamification choices can matter. Do not rely on the current `I am at least 13` checkbox as a neutral age screen if a COPPA age screen is legally required.
9. **Accessibility verification:** manually test VoiceOver/TalkBack, keyboard-only navigation, 200% browser zoom, orientation changes, small phones, large phones, and reduced-motion mode. Fix any page-specific contrast, labeling, focus-order, or reflow failures found in testing.
10. **App privacy disclosures:** make App Store/Play Store privacy labels match the production data flow exactly, including Supabase, OpenAI, Stripe, hosting, AI safety reports, crash/error tooling, and any analytics you later add.
11. **Community operations:** moderation tools only reduce risk if reports are actually reviewed and acted on promptly. Document who handles reports, response targets, appeals, and emergency/escalation procedures.
12. **Copyright/UGC process:** keep a repeatable process for copyright complaints and takedowns. Ask counsel whether a formal DMCA designated-agent registration/process is appropriate for the U.S. Community feature.
13. **Recording consent:** tell users not to record or publish other people without the permissions required where they are located, and review recording-consent rules for the markets where StoryTuner launches.
14. **Security and incident response:** keep Supabase RLS, service-role keys, Stripe/OpenAI secrets, logs, backups, and deletion workflows under review. Establish an incident-response and breach-notification process appropriate to your launch jurisdictions.

## Things deliberately not added automatically

- Arbitration, class-action waivers, governing-law clauses, liability caps, or venue clauses. These can materially affect users' legal rights and should be drafted for the actual legal entity by counsel.
- A fake company address, corporate name, DPO, privacy officer, or DMCA agent.
- A forced COPPA age gate without deciding the intended-audience classification.
- Placeholder Sign in with Apple or App Store IAP code without the necessary Apple product IDs, credentials, and distribution decisions.

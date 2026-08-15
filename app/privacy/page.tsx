import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { legalBackTarget, legalChildHref } from "@/lib/legal-navigation"

export const metadata: Metadata = {
  title: "Privacy Policy · StoryTuner",
  description: "StoryTuner Privacy Policy.",
}

type LegalSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PrivacyPage({ searchParams }: { searchParams?: LegalSearchParams }) {
  const params = searchParams ? await searchParams : {}
  const back = legalBackTarget(params)

  return (
    <LegalPage
      backHref={back.href}
      backLabel={back.label}
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="This policy explains what StoryTuner collects, why it is used, the services that process it, and how you can access or delete your information."
    >
      <LegalSection title="Information StoryTuner collects">
        <p><strong className="text-foreground">Account information.</strong> If you create an account, StoryTuner receives your email address and authentication identifiers from the sign-in provider, plus the public username and display name you choose.</p>
        <p><strong className="text-foreground">Learning and app activity.</strong> StoryTuner stores lesson progress, answers, XP, streak activity, preferences, membership status, and similar information needed to sync your experience.</p>
        <p><strong className="text-foreground">Stories and recordings.</strong> When you choose to record a story, StoryTuner may process audio, transcripts, scores, revisions, titles, and related metadata. Full video is designed to remain on the device where it was recorded unless a feature clearly tells you otherwise.</p>
        <p><strong className="text-foreground">Community content.</strong> If you deliberately share to Community, StoryTuner processes the post, transcript or audio you choose to share, replies, likes, reports, and moderation information.</p>
        <p><strong className="text-foreground">Billing information.</strong> Payments are processed by Stripe. StoryTuner stores billing identifiers and subscription status needed to recognize your membership, but does not store your full payment-card number.</p>
        <p><strong className="text-foreground">Safety and AI reports.</strong> If you report an AI-generated response, StoryTuner stores the reported response and report metadata so it can investigate safety and quality concerns.</p>
        <p><strong className="text-foreground">Technical and security information.</strong> Hosting, authentication, and security systems may process ordinary connection, device, request, error, and fraud-prevention information needed to operate and protect the service.</p>
      </LegalSection>

      <LegalSection title="How information is used">
        <p>StoryTuner uses information to provide and sync the service, transcribe and evaluate stories, personalize coaching when you enable that feature, operate Community, process subscriptions, prevent abuse, troubleshoot problems, and respond to support or privacy requests.</p>
        <p>StoryTuner does not sell your personal information and does not use your information for targeted advertising.</p>
      </LegalSection>

      <LegalSection title="AI features">
        <p>When you use AI-powered features, relevant text, transcripts, instructions, and other necessary context may be sent to OpenAI to generate transcription, feedback, moderation, planning, or coaching results. StoryTuner limits the information sent to what is reasonably needed for the feature you chose.</p>
        <p>Personalization with patterns from past recordings is controlled by the setting labeled “Personalize Parch with past recordings.”</p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>StoryTuner relies on service providers including Supabase for authentication, database, and storage; OpenAI for AI features; Stripe for billing; and Vercel for hosting and delivery. These providers process information for StoryTuner subject to their applicable service terms and safeguards.</p>
      </LegalSection>

      <LegalSection title="Community and public information">
        <p>Your private recordings are not automatically posted to Community. Content becomes visible to other members only when you intentionally share or publish it. Your chosen public display name or username may appear with shared content.</p>
        <p>Community content may be automatically screened and may be reviewed by moderators when it is reported or flagged for safety.</p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>You can delete individual StoryTuner data, recordings, or your entire account from Settings. Account deletion is designed to remove your account and associated StoryTuner content, including user-generated content, subject to limited information that may need to be retained for security, fraud prevention, billing, tax, dispute, or other legal obligations.</p>
        <p>Payment processors and infrastructure providers may retain records under their own legal obligations and retention rules even after StoryTuner deletes its active copy.</p>
      </LegalSection>

      <LegalSection title="Your choices and requests">
        <p>You can update your display name and personalization settings, delete recordings, erase app data, or permanently delete your account from Settings. If you cannot access the app, use the public <Link prefetch href={legalChildHref("/delete-account", params)}>account deletion page</Link> or email storytunerapp@gmail.com to request deletion.</p>
        <p>If you withdraw permission for a browser or device feature such as microphone or camera access, you can continue using portions of StoryTuner that do not require that permission.</p>
      </LegalSection>

      <LegalSection title="Age">
        <p>StoryTuner is intended for people age 13 and older. If StoryTuner learns that it has collected personal information from a child in circumstances where parental consent is legally required, it will take appropriate steps to delete or otherwise handle that information as required by law.</p>
      </LegalSection>

      <LegalSection title="Security and changes">
        <p>StoryTuner uses access controls, authenticated requests, private storage rules, and other safeguards intended to reduce unauthorized access. No online system can promise absolute security.</p>
        <p>This policy may change as StoryTuner changes. Material changes will be communicated in a reasonable way before they take effect when required.</p>
      </LegalSection>
    </LegalPage>
  )
}

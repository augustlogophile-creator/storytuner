import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { legalBackTarget } from "@/lib/legal-navigation"

export const metadata: Metadata = {
  title: "Privacy Policy · Tellwise",
  description: "Tellwise Privacy Policy.",
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
      summary="This policy explains what information Tellwise collects, why it’s used, which services process it, and how you can access or delete it."
    >
      <LegalSection title="Information Tellwise Collects">
        <p><strong className="text-foreground">Account information.</strong> If you create an account, Tellwise receives your email address and authentication identifiers from your sign-in provider, plus your required public username and any display name used for personal greetings.</p>
        <p><strong className="text-foreground">Learning and app activity.</strong> Tellwise stores lesson progress, answers, XP, streak activity, preferences, membership status, and similar information needed to sync your experience.</p>
        <p><strong className="text-foreground">Stories and recordings.</strong> When you record a story, Tellwise may process audio, transcripts, scores, revisions, titles, and related metadata.</p>
        <p><strong className="text-foreground">Community content.</strong> If you choose to share to Community, Tellwise processes the post, transcript or audio you share, along with replies, likes, reports, and moderation information. This content is visible to other members only because you chose to publish it there.</p>
        <p><strong className="text-foreground">Billing information.</strong> Payments are processed by Stripe. Tellwise stores billing identifiers and subscription status needed to recognize your membership, but does not store your full payment-card number.</p>
        <p><strong className="text-foreground">Safety and AI reports.</strong> If you report an AI-generated response, Tellwise stores the reported response and report metadata so it can investigate safety and quality concerns.</p>
        <p><strong className="text-foreground">Technical and security information.</strong> Hosting, authentication, and security systems may process ordinary connection, device, request, error, and fraud-prevention information needed to operate and protect the service.</p>
      </LegalSection>

      <LegalSection title="How Information Is Used">
        <p>Tellwise uses information to provide and sync the service, transcribe and evaluate stories, operate Community, process subscriptions, prevent abuse, troubleshoot problems, and respond to support or privacy requests.</p>
        <p>Tellwise does not sell your personal information and does not use it for targeted advertising.</p>
      </LegalSection>

      <LegalSection title="AI Features">
        <p>When you use AI-powered features, relevant text, transcripts, instructions, and other necessary context may be sent to OpenAI to generate transcription, feedback, moderation, planning, or coaching results. Tellwise limits what it sends to only what’s reasonably needed for the feature you’re using.</p>
        <p>If personalization from past recordings is enabled for your account, Tellwise may use patterns from prior transcripts, scores, strengths, and revisions as coaching context. Raw video is not used as long-term personalization context.</p>
      </LegalSection>

      <LegalSection title="Service Providers">
        <p>Tellwise relies on the following service providers, each processing information subject to their own applicable terms and safeguards:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-foreground">Supabase</strong>: authentication, database, and storage</li>
          <li><strong className="text-foreground">OpenAI</strong>: AI features</li>
          <li><strong className="text-foreground">Stripe</strong>: billing</li>
          <li><strong className="text-foreground">Vercel</strong>: hosting and delivery</li>
        </ul>
      </LegalSection>

      <LegalSection title="Community and Public Information">
        <p>Your private recordings are not automatically posted to Community. Content becomes visible to other members only when you intentionally share or publish it. Your public @username appears alongside any shared Community content.</p>
        <p>Community content may be automatically screened and may also be reviewed by moderators when it’s reported or flagged for safety.</p>
      </LegalSection>

      <LegalSection title="Retention and Deletion">
        <p>You can delete individual data, recordings, or your entire account from Settings. Account deletion removes your account and associated content, including user-generated content, subject to limited information that may need to be retained for security, fraud prevention, billing, tax, dispute, or other legal obligations.</p>
        <p>Payment processors and infrastructure providers may retain records under their own legal obligations and retention rules even after Tellwise deletes its active copy.</p>
      </LegalSection>

      <LegalSection title="Your Choices and Requests">
        <p>You can update your display name, delete recordings, erase app data, or permanently delete your account from Settings. If you can’t access the app, email <a className="underline underline-offset-4" href="mailto:tellwiseapp@gmail.com">tellwiseapp@gmail.com</a> to request deletion.</p>
        <p>If you withdraw permission for a browser or device feature such as microphone or camera access, you can continue using the parts of Tellwise that don’t require that permission.</p>
      </LegalSection>

      <LegalSection title="Age">
        <p>Tellwise is intended for people age 13 and older. If Tellwise learns it has collected personal information from a child in circumstances where parental consent is legally required, it will take appropriate steps to delete or otherwise handle that information as required by law.</p>
      </LegalSection>

      <LegalSection title="Security and Changes">
        <p>Tellwise uses access controls, authenticated requests, private storage rules, and other safeguards intended to reduce unauthorized access. No online system can promise absolute security.</p>
        <p>This policy may change as Tellwise changes. Material changes will be communicated in a reasonable way before they take effect, when required.</p>
      </LegalSection>
    </LegalPage>
  )
}

import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service · StoryTuner",
  description: "StoryTuner Terms of Service.",
}

type LegalSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function TermsPage({ searchParams }: { searchParams?: LegalSearchParams }) {
  const params = searchParams ? await searchParams : {}
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from
  const fromProfile = rawFrom === "profile"

  return (
    <LegalPage
      backHref={fromProfile ? "/profile" : "/"}
      backLabel={fromProfile ? "Back to profile" : "StoryTuner"}
      eyebrow="Terms"
      title="Terms of Service"
      summary="These terms govern use of StoryTuner, including accounts, Community, AI features, XP, and paid membership."
    >
      <LegalSection title="Eligibility and your account">
        <p>You must be at least 13 years old to create a StoryTuner account. If you are not old enough to enter a binding agreement where you live, use StoryTuner only with permission from a parent or legal guardian.</p>
        <p>You are responsible for activity on your account and for keeping access to your sign-in method secure. Public profile names must follow StoryTuner’s safety rules.</p>
      </LegalSection>

      <LegalSection title="StoryTuner is a learning tool">
        <p>StoryTuner provides educational exercises, AI-generated feedback, transcription, planning, and coaching. AI output can be incomplete or wrong. You remain responsible for deciding how to use feedback and for reviewing important information before relying on it.</p>
      </LegalSection>

      <LegalSection title="Paid membership and automatic renewal">
        <p>When you purchase the annual StoryTuner Membership on the web, the price shown at checkout is charged for the stated annual term. Unless you cancel, the membership automatically renews for another annual term at the disclosed renewal price.</p>
        <p>The purchase screen displays the renewal period, charge, renewal terms, and cancellation method before checkout. You must affirmatively accept the automatic-renewal disclosure before StoryTuner opens checkout.</p>
        <p>You can stop future renewal online from Profile → Membership → Cancel renewal. Cancellation stops the next automatic charge and ordinarily leaves paid access available through the end of the current paid period. You can also open Stripe billing settings from the Membership page.</p>
        <p>Where a platform requires its own payment system, purchases made through that platform may also be governed by the platform’s purchase, renewal, cancellation, and refund rules.</p>
      </LegalSection>

      <LegalSection title="XP and Parch">
        <p>XP is an in-service progress and customization unit. It has no cash value, cannot be redeemed for money, and is not transferable outside StoryTuner. StoryTuner may adjust XP rules or cosmetic availability to keep the system fair, but will not represent XP as money or an investment.</p>
      </LegalSection>

      <LegalSection title="Your content and recordings">
        <p>You keep ownership of the original stories and other content you create. You give StoryTuner a limited license to host, process, reproduce, and display that content only as needed to provide the features you request, such as storing a recording, generating feedback, or showing a Community post you chose to share.</p>
        <p>Only record, upload, or publish another person’s voice, image, private information, or other material when you have the permission required where you are located and where the recording occurs.</p>
        <p>You may not upload or share content you do not have the right to use, or content that violates another person’s privacy, publicity, intellectual-property, or other rights.</p>
      </LegalSection>

      <LegalSection title="Community rules">
        <p>Community content must follow the published Community Guidelines. StoryTuner may filter, hold, remove, or restrict content or accounts to protect members and enforce these rules. Members can report content and block other members.</p>
        <p>Do not post harassment, hateful or sexual content, threats, private personal information, spam, illegal material, or content that infringes another person’s rights.</p>
      </LegalSection>

      <LegalSection title="Copyright complaints">
        <p>If you believe content on StoryTuner infringes your copyright or other intellectual-property rights, email storytunerapp@gmail.com with enough information to identify the work, the allegedly infringing material, your contact information, and the basis for your request. StoryTuner may remove content while a complaint is reviewed.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Do not misuse StoryTuner, attempt unauthorized access, interfere with security controls, scrape private content, impersonate another person, abuse reporting systems, or use the service to violate law or harm another person.</p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>StoryTuner may change, suspend, or discontinue features as the product evolves. StoryTuner will try to give reasonable notice when a material change affects a paid service or legal right.</p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>To the extent permitted by applicable law, StoryTuner is provided on an “as available” basis without a promise that every AI result, transcription, score, or service feature will always be accurate or uninterrupted. Nothing in these terms limits rights that cannot legally be waived.</p>
      </LegalSection>

      <LegalSection title="Ending use">
        <p>You may stop using StoryTuner at any time. You can delete your account in Settings. Paid membership cancellation and account deletion are separate actions, although StoryTuner’s account-deletion flow is designed to cancel linked StoryTuner billing before removing the account.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms can be sent to storytunerapp@gmail.com.</p>
      </LegalSection>
    </LegalPage>
  )
}

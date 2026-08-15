import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { legalBackTarget } from "@/lib/legal-navigation"

export const metadata: Metadata = {
  title: "Community Guidelines · StoryTuner",
  description: "Rules for StoryTuner Community.",
}

type LegalSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function CommunityGuidelinesPage({ searchParams }: { searchParams?: LegalSearchParams }) {
  const params = searchParams ? await searchParams : {}
  const back = legalBackTarget(params)

  return (
    <LegalPage
      backHref={back.href}
      backLabel={back.label}
      eyebrow="Community"
      title="Community Guidelines"
      summary="Share stories, not harm. These rules apply to Community posts, transcripts, audio, replies, profile names, and other member-visible content."
    >
      <LegalSection title="Keep people safe">
        <p>Do not post threats, targeted harassment, hateful attacks, sexual exploitation, encouragement of self-harm, doxxing, or private personal information about another person.</p>
      </LegalSection>
      <LegalSection title="Share what you have the right to share">
        <p>Only publish material you created or have permission to use. Respect copyright, privacy, publicity, and other rights.</p>
      </LegalSection>
      <LegalSection title="Keep the Community useful">
        <p>Do not spam, impersonate others, manipulate likes or reports, repeatedly post misleading material, or use Community primarily to advertise unrelated products or services.</p>
      </LegalSection>
      <LegalSection title="Reports, blocks, and moderation">
        <p>You can report offensive content and block another member from Community controls. StoryTuner may use automated safety screening and human review. Content can be held, removed, or restored after review, and accounts may be restricted for serious or repeated violations.</p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>For safety concerns that cannot be handled with the in-app report tool, contact storytunerapp@gmail.com.</p>
      </LegalSection>
    </LegalPage>
  )
}

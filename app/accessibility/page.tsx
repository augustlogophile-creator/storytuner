import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Accessibility · StoryTuner",
  description: "StoryTuner accessibility statement.",
}

type LegalSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AccessibilityPage({ searchParams }: { searchParams?: LegalSearchParams }) {
  const params = searchParams ? await searchParams : {}
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from
  const fromProfile = rawFrom === "profile"

  return (
    <LegalPage
      backHref={fromProfile ? "/profile" : "/"}
      backLabel={fromProfile ? "Back to profile" : "StoryTuner"}
      eyebrow="Accessibility"
      title="Accessibility"
      summary="StoryTuner aims to make its core learning, recording, account, and Community experiences usable with keyboard, touch, zoom, and assistive technology."
    >
      <LegalSection title="Current approach">
        <p>StoryTuner uses semantic headings and controls, visible keyboard focus, text labels for interactive controls, alternatives to drag-only page turning, mobile-safe touch targets, responsive layouts, and support for browser text zoom.</p>
        <p>The interface also respects the operating system’s reduced-motion preference for nonessential CSS motion.</p>
      </LegalSection>
      <LegalSection title="Feedback">
        <p>If a StoryTuner feature is difficult to use with a screen reader, keyboard, switch device, voice control, zoom, or another assistive technology, email storytunerapp@gmail.com. Include the page and what you were trying to do so the issue can be reproduced and fixed.</p>
      </LegalSection>
      <LegalSection title="Ongoing work">
        <p>Accessibility is an ongoing engineering requirement, not a one-time certification. StoryTuner will continue reviewing contrast, focus order, labels, reflow, touch targets, error messages, and new features as the product changes.</p>
      </LegalSection>
    </LegalPage>
  )
}

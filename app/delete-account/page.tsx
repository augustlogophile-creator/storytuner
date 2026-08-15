import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Delete your account · StoryTuner",
  description: "How to request deletion of a StoryTuner account and associated data.",
}

export default function DeleteAccountPage() {
  return (
    <LegalPage
      eyebrow="Account control"
      title="Delete your StoryTuner account"
      summary="You can permanently delete your StoryTuner account and associated data from inside the app, or request deletion if you cannot access the app."
    >
      <LegalSection title="Delete from StoryTuner">
        <p>While signed in, open <strong className="text-foreground">Profile → Settings → Delete account permanently</strong>. StoryTuner asks you to confirm before the deletion begins.</p>
        <p>If you can sign in now, <Link href="/settings">open Settings</Link>.</p>
      </LegalSection>

      <LegalSection title="Request deletion without the app">
        <p>If you cannot access StoryTuner, email <a href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20account%20deletion%20request">storytunerapp@gmail.com</a> and ask to delete your StoryTuner account. Send the request from the email address associated with the account when possible so ownership can be verified without asking for unnecessary information.</p>
      </LegalSection>

      <LegalSection title="What deletion covers">
        <p>Account deletion is designed to remove your login, profile, learning progress, XP, recordings, transcripts, Community activity, Planner history, and other StoryTuner content associated with the account. Linked StoryTuner billing is canceled as part of the deletion flow.</p>
        <p>Limited records may be retained when reasonably necessary for security, fraud prevention, billing, tax, disputes, or other legal obligations, as described in the Privacy Policy.</p>
      </LegalSection>
    </LegalPage>
  )
}

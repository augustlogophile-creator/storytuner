import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { legalBackTarget } from "@/lib/legal-navigation"

export const metadata: Metadata = {
  title: "Delete your account · Tellwise",
  description: "How to request deletion of a Tellwise account and associated data.",
}

type LegalSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function DeleteAccountPage({ searchParams }: { searchParams?: LegalSearchParams }) {
  const params = searchParams ? await searchParams : {}
  const back = legalBackTarget(params)

  return (
    <LegalPage
      backHref={back.href}
      backLabel={back.label}
      eyebrow="Account control"
      title="Delete your Tellwise account"
      summary="You can permanently delete your Tellwise account and associated data from inside the app, or request deletion if you cannot access the app."
    >
      <LegalSection title="Delete from Tellwise">
        <p>While signed in, open <strong className="text-foreground">Profile → Settings → Delete account permanently</strong>. Tellwise asks you to confirm before the deletion begins.</p>
        <p>If you can sign in now, <Link href="/settings">open Settings</Link>.</p>
      </LegalSection>

      <LegalSection title="Request deletion without the app">
        <p>If you cannot access Tellwise, email <a href="mailto:tellwiseapp@gmail.com?subject=Tellwise%20account%20deletion%20request">tellwiseapp@gmail.com</a> and ask to delete your Tellwise account. Send the request from the email address associated with the account when possible so ownership can be verified without asking for unnecessary information.</p>
      </LegalSection>

      <LegalSection title="What deletion covers">
        <p>Account deletion is designed to remove your login, profile, learning progress, XP, recordings, transcripts, Community activity, Planner history, and other Tellwise content associated with the account. Linked Tellwise billing is canceled as part of the deletion flow.</p>
        <p>Limited records may be retained when reasonably necessary for security, fraud prevention, billing, tax, disputes, or other legal obligations, as described in the Privacy Policy.</p>
      </LegalSection>
    </LegalPage>
  )
}

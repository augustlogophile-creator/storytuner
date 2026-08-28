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
      title="Delete your Tellwise account"
      summary="You can permanently delete your Tellwise account and associated data from inside the app, or request deletion if you can&apos;t access the app."
    >
      <LegalSection title="Delete from Tellwise">
        <p>While signed in, open <strong className="text-foreground">Profile → Settings → Delete account permanently</strong>. Tellwise asks you to confirm before the deletion begins.</p>
        <p>If you can sign in now, <Link href="/settings">open Settings</Link>.</p>
      </LegalSection>

      <LegalSection title="Request deletion without the app">
        <p>If you can&apos;t access Tellwise, email <a className="underline underline-offset-4" href="mailto:tellwiseapp@gmail.com?subject=Tellwise%20account%20deletion%20request">tellwiseapp@gmail.com</a> and ask to delete your Tellwise account. Send the request from the email address associated with the account when possible so ownership can be verified without asking for unnecessary information.</p>
      </LegalSection>

      <LegalSection title="What deletion covers">
        <p>Account deletion is designed to remove your login, profile, learning progress, XP, recordings, transcripts, Community activity, Planner history, and other Tellwise content associated with the account. Linked Tellwise billing is canceled as part of the deletion flow.</p>
        <p>Limited records may be retained when reasonably necessary for security, fraud prevention, billing, tax, disputes, or other legal obligations, as described in the Privacy Policy.</p>
      </LegalSection>

      <LegalSection title="Re-registration waiting period">
        <p>Tellwise enforces a waiting period of up to 14 days before a deleted email address becomes eligible for a new registration, to help prevent account-deletion abuse and protect account security.</p>
        <p>If you try to sign up again before the waiting period ends, Tellwise will show the date when that email becomes eligible to create a new account again. Permanent deletion still deletes the old account. Deleted data cannot be restored.</p>
      </LegalSection>
    </LegalPage>
  )
}

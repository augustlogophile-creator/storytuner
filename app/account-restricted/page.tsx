import Link from "next/link"
import { Ban, Clock3, Mail } from "lucide-react"
import { MobileShell } from "@/components/mobile-shell"
import { Eyebrow } from "@/components/eyebrow"
import { getAccountRestriction, getAuthenticatedUser } from "@/lib/require-auth"

export default async function AccountRestrictedPage() {
  const authenticated = await getAuthenticatedUser()
  const restriction = authenticated ? await getAccountRestriction(authenticated.id) : null
  const banned = restriction?.accountStatus === "banned"
  const until = restriction?.accountSuspendedUntil

  return (
    <MobileShell nav={false}>
      <div className="flex min-h-[75vh] flex-col justify-center">
        <section className="rounded-[2rem] border border-destructive/25 bg-card p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            {banned ? <Ban className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
          </span>
          <Eyebrow className="mt-5">Account access</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {banned ? "This account has been disabled." : "This account is temporarily suspended."}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {restriction?.publicMessage || "StoryTuner restricted this account after a moderation review."}
          </p>
          {until && !banned && (
            <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold">
              Access is scheduled to return {new Date(until).toLocaleString()}.
            </p>
          )}
          <a href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Account%20Review" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            <Mail className="h-4 w-4" /> Request a review
          </a>
          <Link href="/sign-in" className="mt-2 flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-muted-foreground">
            Return to sign in
          </Link>
        </section>
      </div>
    </MobileShell>
  )
}

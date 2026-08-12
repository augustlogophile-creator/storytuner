import { Ban, Clock3 } from "lucide-react"
import { RestrictedAccountActions } from "@/components/moderation/restricted-account-actions"
import { MobileShell } from "@/components/mobile-shell"
import { RestrictionStatusWatcher } from "@/components/moderation/restriction-status-watcher"
import { Eyebrow } from "@/components/eyebrow"
import {
  getAccountRestriction,
  getAccountRestrictionDecisionContext,
  getAuthenticatedUser,
} from "@/lib/require-auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AccountRestrictedPage() {
  const authenticated = await getAuthenticatedUser()
  const restriction = authenticated ? await getAccountRestriction(authenticated.id) : null
  const banned = restriction?.accountStatus === "banned"
  const until = restriction?.accountSuspendedUntil
  const decision = authenticated && restriction
    ? await getAccountRestrictionDecisionContext(authenticated.id, restriction.accountStatus)
    : null
  const moderatorNote = decision?.note || restriction?.publicMessage || null

  return (
    <MobileShell nav={false}>
      <RestrictionStatusWatcher />
      <div className="flex min-h-[75vh] flex-col justify-center">
        <section className="rounded-[1.35rem] border border-destructive/20 bg-card p-5 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            {banned ? <Ban className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
          </span>
          <Eyebrow className="mt-5">Account access</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {banned ? "This account has been disabled." : "This account is temporarily suspended."}
          </h1>

          {decision?.content ? (
            <div className="mt-5 text-left">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Content involved</p>
              <blockquote className="mt-2 rounded-2xl bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
                {decision.content}
              </blockquote>
              <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Moderator note</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {moderatorNote || "StoryTuner restricted this account after a moderation review."}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {moderatorNote || "StoryTuner restricted this account after a moderation review."}
            </p>
          )}

          {until && !banned && (
            <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-[0.8rem] font-medium">
              Access is scheduled to return {new Date(until).toLocaleString()}.
            </p>
          )}

          <RestrictedAccountActions />
        </section>
      </div>
    </MobileShell>
  )
}

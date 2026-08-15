import Link from "next/link"
import { MobileShell } from "@/components/mobile-shell"
import { BackLink } from "@/components/page-header"

const items = [
  { href: "/privacy", title: "Privacy Policy", detail: "What StoryTuner collects, how it is used, and how to request deletion." },
  { href: "/terms", title: "Terms of Service", detail: "Accounts, subscriptions, Community, AI features, and acceptable use." },
  { href: "/accessibility", title: "Accessibility", detail: "Accessibility approach and a direct way to report a barrier." },
  { href: "/community-guidelines", title: "Community Guidelines", detail: "Safety, reporting, blocking, moderation, and member conduct." },
  { href: "/delete-account", title: "Account deletion help", detail: "Public instructions for deleting your StoryTuner account, even without app access." },
]

type LegalSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function LegalHubPage({ searchParams }: { searchParams?: LegalSearchParams }) {
  const params = searchParams ? await searchParams : {}
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from
  const fromProfile = rawFrom === "profile"
  const itemHref = (href: string) => fromProfile ? `${href}?from=legal-profile` : `${href}?from=legal`

  return (
    <MobileShell>
      <div className="flex flex-col gap-5">
        <BackLink href="/profile" label="Profile" />
        <header>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">Account information</p>
          <h1 className="mt-2 text-[1.65rem] font-semibold tracking-[-0.03em]">Legal and accessibility</h1>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-muted-foreground">Privacy, terms, accessibility, Community rules, and account deletion information.</p>
        </header>

        <section className="story-card overflow-hidden rounded-[1.35rem] px-4">
          {items.map((item, index) => (
            <div key={item.href}>
              {index > 0 && <div className="h-px bg-border" />}
              <Link prefetch href={itemHref(item.href)} className="group block py-4">
                <span className="block text-[0.94rem] font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-[0.72rem] leading-5 text-muted-foreground">{item.detail}</span>
              </Link>
            </div>
          ))}
        </section>
      </div>
    </MobileShell>
  )
}

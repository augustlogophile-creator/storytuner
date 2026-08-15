import Link from "next/link"
import { notFound } from "next/navigation"
import { Activity, ChevronRight, Flag, ShieldCheck } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { MobileShell } from "@/components/mobile-shell"
import { moderatorRoleFromClaims } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function OwnerToolsPage() {
  const user = await requireStoryTunerUser("/admin")
  if (moderatorRoleFromClaims(user.claims) !== "admin") notFound()

  return (
    <MobileShell>
      <div className="flex min-w-0 flex-col gap-5 pb-6">
        <BackLink href="/profile" label="Profile" />
        <header>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Private owner area</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Owner tools</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Three simple places to review reports and make sure StoryTuner is running normally.</p>
        </header>

        <section className="story-card overflow-hidden rounded-[1.5rem] px-4">
          <OwnerRow
            href="/admin/community"
            icon={ShieldCheck}
            title="Community reports"
            detail="Review reported posts and replies, then decide what to do."
          />
          <Divider />
          <OwnerRow
            href="/admin/ai-reports"
            icon={Flag}
            title="AI reply reports"
            detail="Review Parch replies that members said were wrong or unhelpful."
          />
          <Divider />
          <OwnerRow
            href="/admin/system"
            icon={Activity}
            title="App status"
            detail="See whether core services are working and clean up old data."
          />
        </section>

        <div className="rounded-[1.35rem] bg-secondary/45 px-4 py-3 text-xs leading-5 text-muted-foreground">
          These tools are only available to the StoryTuner owner account.
        </div>
      </div>
    </MobileShell>
  )
}

function OwnerRow({ href, icon: Icon, title, detail }: { href: string; icon: typeof ShieldCheck; title: string; detail: string }) {
  return (
    <Link href={href} prefetch className="group flex items-center gap-3 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9rem] font-semibold tracking-[-0.015em]">{title}</span>
        <span className="mt-0.5 block text-[0.69rem] leading-5 text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
    </Link>
  )
}

function Divider() {
  return <div className="ml-[3.25rem] h-px bg-border" />
}

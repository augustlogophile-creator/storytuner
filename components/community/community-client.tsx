"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import { CheckCircle2, Heart, LoaderCircle, LockKeyhole, MessageCircle, RefreshCw, Send } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import type { CommunityFeedPost, CommunityFeedResponse } from "@/lib/community/types"
import { cn } from "@/lib/utils"

type CommunityClientProps = {
  membershipActive: boolean
  currentDisplayName: string
}

export function CommunityClient({ membershipActive, currentDisplayName }: CommunityClientProps) {
  if (!membershipActive) return <MembershipLock />
  return <MemberCommunity currentDisplayName={currentDisplayName} />
}

function MembershipLock() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <Eyebrow>Paid feature</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Community requires a paid StoryTuner Membership.</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
          Free accounts cannot read posts, publish stories, reply, or like content in Community.
        </p>
      </header>

      <section className="rounded-3xl border border-brand/35 bg-brand-soft/40 px-6 py-9">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
            <LockKeyhole className="h-6 w-6 text-accent-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Unlock the full Community</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Membership lets you share selected text, transcripts, and audio, then respond to other storytellers. Nothing from your private recordings is shared automatically.
          </p>
          <Link
            href="/membership"
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            View Membership
          </Link>
        </div>
      </section>
    </div>
  )
}

function MemberCommunity({ currentDisplayName }: { currentDisplayName: string }) {
  const [posts, setPosts] = useState<CommunityFeedPost[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [feedError, setFeedError] = useState("")
  const [draft, setDraft] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState("")
  const [membershipRequired, setMembershipRequired] = useState(false)

  const loadPage = useCallback(async (targetPage: number, replace: boolean) => {
    replace ? setLoading(true) : setLoadingMore(true)
    setFeedError("")

    try {
      const response = await fetch(`/api/community/feed?page=${targetPage}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const payload = (await response.json()) as CommunityFeedResponse & { error?: string }
      if (response.status === 403 && payload.error?.toLowerCase().includes("membership")) {
        setMembershipRequired(true)
        return
      }
      if (!response.ok) throw new Error(payload.error || "Community posts could not be loaded.")

      setPosts((current) => replace ? payload.posts : mergePosts(current, payload.posts))
      setPage(payload.page)
      setHasMore(payload.hasMore)
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Community posts could not be loaded.")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadPage(0, true)
  }, [loadPage])

  async function publishPost() {
    const body = draft.trim()
    if (!body || publishing) return

    setPublishing(true)
    setPublishError("")
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body }),
      })
      const payload = (await response.json()) as { post?: CommunityFeedPost; error?: string }
      if (response.status === 403 && payload.error?.toLowerCase().includes("membership")) {
        setMembershipRequired(true)
        return
      }
      if (!response.ok || !payload.post) throw new Error(payload.error || "Your post could not be published.")

      setPosts((current) => [payload.post!, ...current.filter((post) => post.id !== payload.post!.id)])
      setDraft("")
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Your post could not be published.")
    } finally {
      setPublishing(false)
    }
  }

  if (membershipRequired) return <MembershipLock />

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Community</Eyebrow>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[0.7rem] font-semibold text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Membership active
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Stories shared on purpose.</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
          A calm space for specific, thoughtful responses. Nothing from your Story Reel appears here unless you share it.
        </p>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Community principle</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Respond to what landed, not what you would have done differently. Curiosity is more useful than correction.</p>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Share with Community</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Posting as {currentDisplayName}</p>
          </div>
          <span className={cn("font-mono text-[0.65rem]", draft.length > 4500 ? "text-destructive" : "text-muted-foreground")}>{draft.length}/5000</span>
        </div>
        <textarea
          value={draft}
          maxLength={5000}
          rows={4}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)}
          placeholder="Share a story, reflection, or moment you are working through…"
          className="mt-4 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-brand"
        />
        {publishError && <p className="mt-2 text-sm text-destructive" role="alert">{publishError}</p>}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={publishPost}
            disabled={!draft.trim() || publishing}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </section>

      <section aria-live="polite">
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-border bg-card px-6 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading Community…
          </div>
        ) : feedError ? (
          <div className="rounded-3xl border border-destructive/30 bg-card px-6 py-8 text-center">
            <p className="text-sm font-semibold">Community could not load.</p>
            <p className="mt-1 text-sm text-muted-foreground">{feedError}</p>
            <button type="button" onClick={() => void loadPage(0, true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-sm font-semibold">No stories have been shared yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Your first text post can begin the Community.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
            {hasMore && (
              <button
                type="button"
                onClick={() => void loadPage(page + 1, false)}
                disabled={loadingMore}
                className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function PostCard({ post }: { post: CommunityFeedPost }) {
  return (
    <article id={post.id} className="scroll-mt-24 rounded-3xl border border-border bg-card p-5">
      <div>
        <p className="text-sm font-semibold">{post.author.displayName}</p>
        <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
          Text post · {relativeDate(post.createdAt)}{post.editedAt ? " · edited" : ""}
        </p>
      </div>
      {post.title && <h2 className="mt-4 text-base font-semibold">{post.title}</h2>}
      <p className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-7 text-foreground/90 text-pretty">{post.body}</p>
      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground">
          <Heart className="h-3.5 w-3.5" fill={post.likedByViewer ? "currentColor" : "none"} />{post.likeCount}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageCircle className="h-3.5 w-3.5" />{post.replyCount}</span>
      </div>
    </article>
  )
}

function mergePosts(current: CommunityFeedPost[], incoming: CommunityFeedPost[]) {
  const seen = new Set(current.map((post) => post.id))
  return [...current, ...incoming.filter((post) => !seen.has(post.id))]
}

function relativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  Flag,
  FileText,
  Headphones,
  Heart,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Pause,
  Play,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { Eyebrow } from "@/components/eyebrow"
import type {
  CommunityAuthor,
  CommunityFeedPost,
  CommunityFeedResponse,
  CommunityRepliesResponse,
  CommunityReply,
  CommunityReportReason,
} from "@/lib/community/types"
import { cn } from "@/lib/utils"
import { countActiveRenderableReplies } from "@/lib/community/visible-replies"

type CommunityClientProps = {
  membershipActive: boolean
  currentUsername: string
}

type ApiErrorPayload = { error?: string }

type MenuItem = {
  label: string
  icon: typeof Pencil
  tone?: "default" | "danger"
  onSelect: () => void
}

const reportReasons: { value: CommunityReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hateful content" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence or threats" },
  { value: "self_harm", label: "Self-harm content" },
  { value: "personal_information", label: "Private personal information" },
  { value: "spam", label: "Spam or misleading content" },
  { value: "other", label: "Something else" },
]

export function CommunityClient({ membershipActive, currentUsername }: CommunityClientProps) {
  if (!membershipActive) return <MembershipLock />
  return <MemberCommunity currentUsername={currentUsername} />
}

function MembershipLock() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <Eyebrow>Paid feature</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
          Community requires a paid StoryTuner Membership.
        </h1>
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
            Membership lets you share selected text, transcripts, and audio, then respond to other storytellers.
            Nothing from your private recordings is shared automatically.
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

function MemberCommunity({ currentUsername }: { currentUsername: string }) {
  const [posts, setPosts] = useState<CommunityFeedPost[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [feedError, setFeedError] = useState("")
  const [draft, setDraft] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState("")
  const [publishNotice, setPublishNotice] = useState("")
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
      const payload = (await response.json()) as CommunityFeedResponse & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        setMembershipRequired(true)
        return
      }
      if (!response.ok) throw new Error(payload.error || "Community posts could not be loaded.")

      setPosts((current) => rankPosts(replace ? payload.posts : mergePosts(current, payload.posts)))
      setPage(payload.page)
      setHasMore(payload.hasMore)
    } catch (error) {
      setFeedError(errorMessage(error, "Community posts could not be loaded."))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadPage(0, true)
  }, [loadPage])

  useEffect(() => {
    const refreshAfterBlock = () => void loadPage(0, true)
    window.addEventListener("storytuner:community-blocked", refreshAfterBlock)
    return () => window.removeEventListener("storytuner:community-blocked", refreshAfterBlock)
  }, [loadPage])

  useEffect(() => {
    let lastRefresh = 0
    const refreshVisibleFeed = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastRefresh < 1500) return
      lastRefresh = now
      void loadPage(0, true)
    }

    window.addEventListener("focus", refreshVisibleFeed)
    document.addEventListener("visibilitychange", refreshVisibleFeed)
    const interval = window.setInterval(refreshVisibleFeed, 30000)

    return () => {
      window.removeEventListener("focus", refreshVisibleFeed)
      document.removeEventListener("visibilitychange", refreshVisibleFeed)
      window.clearInterval(interval)
    }
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
      const payload = (await response.json()) as { post?: CommunityFeedPost; heldForReview?: boolean; message?: string } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        setMembershipRequired(true)
        return
      }
      if (response.ok && payload.heldForReview) {
        setDraft("")
        setPublishNotice(payload.message || "This post is being held for moderator review and is not visible to other members.")
        return
      }
      if (!response.ok || !payload.post) throw new Error(payload.error || "Your post could not be published.")

      setFeedError("")
      setPosts((current) => rankPosts([payload.post!, ...current.filter((post) => post.id !== payload.post!.id)]))
      setDraft("")
      window.setTimeout(() => {
        document.getElementById("community-feed")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)
    } catch (error) {
      setPublishError(errorMessage(error, "Your post could not be published."))
    } finally {
      setPublishing(false)
    }
  }

  function updatePost(updated: CommunityFeedPost) {
    setPosts((current) => rankPosts(current.map((post) => (post.id === updated.id ? updated : post))))
  }

  function deletePost(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId))
  }

  if (membershipRequired) return <MembershipLock />

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Community</Eyebrow>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[0.68rem] font-semibold text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Membership active
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">Share stories. Help each other improve.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground text-pretty">
          Community is built around stories people intentionally choose to share. Listen or read, then respond to what actually landed.
        </p>
      </header>

      <section className="rounded-[2rem] border border-brand/35 bg-brand-soft/45 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
            <Headphones className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow>Share a story</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold">Choose a recording to share</h2>
          </div>
        </div>
        <Link href="/arena/recordings" className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.985]">
          <Headphones className="h-4 w-4" /> Choose a story
        </Link>
      </section>

      <section aria-labelledby="share-heading" className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="share-heading" className="text-sm font-semibold">Post a note</h2>
            <p className="mt-1 text-xs text-muted-foreground">Reflections, tips, questions, or what you want to improve · @{currentUsername}</p>
          </div>
          <CharacterCount value={draft.length} maximum={5000} warningAt={4500} />
        </div>
        <textarea value={draft} maxLength={5000} rows={3} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)} placeholder="Share a reflection, a storytelling tip, a question, or something you want to get better at…" className="mt-4 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-brand" />
        {publishError && <p className="mt-2 text-sm text-destructive" role="alert">{publishError}</p>}
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={publishPost} disabled={!draft.trim() || publishing} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {publishing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {publishing ? "Publishing…" : "Post note"}
          </button>
        </div>
      </section>

      <section id="community-feed" aria-labelledby="community-feed-heading" aria-live="polite" className="scroll-mt-20 pt-2">
        <div className="mb-4">
          <Eyebrow>Community feed</Eyebrow>
          <h2 id="community-feed-heading" className="mt-2 text-xl font-semibold tracking-tight">Top stories</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ranked by likes, with newer stories breaking ties.</p>
        </div>

        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center rounded-3xl border border-border bg-card px-6 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading Community…
          </div>
        ) : feedError && posts.length === 0 ? (
          <FeedError message={feedError} onRetry={() => void loadPage(0, true)} />
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-sm font-semibold">No stories have been shared yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Your first post can begin the Community.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feedError && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">The latest refresh failed. Loaded posts are still shown.</p>
                <button type="button" onClick={() => void loadPage(0, true)} className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            )}
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onUpdated={updatePost}
                onDeleted={deletePost}
                onMembershipRequired={() => setMembershipRequired(true)}
                onModerationHeld={(message) => setPublishNotice(message)}
              />
            ))}
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
      <NoticeDialog open={Boolean(publishNotice)} title="Held for review" onClose={() => setPublishNotice("")}>
        {publishNotice}
      </NoticeDialog>
    </div>
  )
}

function FeedError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-destructive/30 bg-card px-6 py-8 text-center">
      <p className="text-sm font-semibold">Community feed could not load.</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold">
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  )
}

type PostCardProps = {
  post: CommunityFeedPost
  onUpdated: (post: CommunityFeedPost) => void
  onDeleted: (postId: string) => void
  onMembershipRequired: () => void
  onModerationHeld: (message: string) => void
}

function PostCard({ post, onUpdated, onDeleted, onMembershipRequired, onModerationHeld }: PostCardProps) {
  const [liking, setLiking] = useState(false)
  const [postError, setPostError] = useState("")
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(post.body)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [notice, setNotice] = useState("")
  const [noticeTitle, setNoticeTitle] = useState("Report received")
  const [threadOpen, setThreadOpen] = useState(false)
  const [threadLoaded, setThreadLoaded] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState("")
  const [replies, setReplies] = useState<CommunityReply[]>([])
  const [replyDraft, setReplyDraft] = useState("")
  const [replyingTo, setReplyingTo] = useState<CommunityReply | null>(null)
  const [postingReply, setPostingReply] = useState(false)
  const [visibleThreadCount, setVisibleThreadCount] = useState(4)
  const [newestReplyId, setNewestReplyId] = useState<string | null>(null)
  const replyComposerRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) setEditDraft(post.body)
  }, [editing, post.body])

  async function togglePostLike() {
    if (liking) return
    setLiking(true)
    setPostError("")
    try {
      const response = await fetch(`/api/community/posts/${post.id}/like`, {
        method: post.likedByViewer ? "DELETE" : "POST",
        headers: { Accept: "application/json" },
      })
      const payload = (await response.json()) as { likedByViewer?: boolean; likeCount?: number } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (!response.ok || typeof payload.likedByViewer !== "boolean" || typeof payload.likeCount !== "number") {
        throw new Error(payload.error || "The like could not be updated.")
      }
      onUpdated({ ...post, likedByViewer: payload.likedByViewer, likeCount: payload.likeCount })
    } catch (error) {
      setPostError(errorMessage(error, "The like could not be updated."))
    } finally {
      setLiking(false)
    }
  }

  async function savePostEdit() {
    const body = editDraft.trim()
    if (!body || savingEdit) return
    setSavingEdit(true)
    setPostError("")
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body }),
      })
      const payload = (await response.json()) as { post?: CommunityFeedPost; heldForReview?: boolean; message?: string } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (response.ok && payload.heldForReview) {
        setEditing(false)
        onModerationHeld(payload.message || "This edit is being held for moderator review and is no longer visible to other members.")
        onDeleted(post.id)
        return
      }
      if (!response.ok || !payload.post) throw new Error(payload.error || "The post could not be updated.")
      onUpdated(payload.post)
      setEditing(false)
    } catch (error) {
      setPostError(errorMessage(error, "The post could not be updated."))
    } finally {
      setSavingEdit(false)
    }
  }

  async function deletePost() {
    if (deleting) return
    setDeleting(true)
    setPostError("")
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      })
      const payload = (await response.json()) as { deleted?: boolean } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (!response.ok || !payload.deleted) throw new Error(payload.error || "The post could not be deleted.")
      setDeleteOpen(false)
      onDeleted(post.id)
    } catch (error) {
      setPostError(errorMessage(error, "The post could not be deleted."))
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  async function loadReplies() {
    setThreadLoading(true)
    setThreadError("")
    try {
      const response = await fetch(`/api/community/posts/${post.id}/replies`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const payload = (await response.json()) as CommunityRepliesResponse & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (!response.ok) throw new Error(payload.error || "Replies could not be loaded.")
      setReplies(payload.replies)
      if (typeof payload.activeReplyCount === "number" && payload.activeReplyCount !== post.replyCount) {
        onUpdated({ ...post, replyCount: payload.activeReplyCount })
      }
      setVisibleThreadCount(4)
      setNewestReplyId(null)
      setThreadLoaded(true)
    } catch (error) {
      setThreadError(errorMessage(error, "Replies could not be loaded."))
    } finally {
      setThreadLoading(false)
    }
  }

  useEffect(() => {
    if (!threadOpen || !threadLoaded) return
    void loadReplies()
    // When the server-side visible reply count changes, refresh the open thread
    // so moderation removals disappear from both the count and the conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.replyCount])

  async function toggleThread() {
    const nextOpen = !threadOpen
    setThreadOpen(nextOpen)
    if (nextOpen && !threadLoading) await loadReplies()
  }

  function beginReply(target: CommunityReply | null) {
    setThreadOpen(true)
    setReplyingTo(target)
    if (!threadLoaded && !threadLoading) void loadReplies()
    window.setTimeout(() => replyComposerRef.current?.focus(), 25)
  }

  async function submitReply() {
    const body = replyDraft.trim()
    if (!body || postingReply) return
    setPostingReply(true)
    setThreadError("")
    try {
      const response = await fetch(`/api/community/posts/${post.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body, parentReplyId: replyingTo?.id ?? null }),
      })
      const payload = (await response.json()) as { reply?: CommunityReply; heldForReview?: boolean; message?: string } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (response.ok && payload.heldForReview) {
        setReplyDraft("")
        setReplyingTo(null)
        setNoticeTitle("Held for review")
        setNotice(payload.message || "This reply is being held for moderator review and is not visible to other members.")
        return
      }
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Your reply could not be posted.")

      setReplies((current) => [...current, payload.reply!])
      setNewestReplyId(payload.reply.id)
      if (!payload.reply.parentReplyId) {
        setVisibleThreadCount((count) => Math.max(count, groupedReplies.length + 1))
      }
      setThreadLoaded(true)
      setReplyDraft("")
      setReplyingTo(null)
      // Every comment counts as a response, including replies to replies.
      onUpdated({ ...post, replyCount: post.replyCount + 1 })
    } catch (error) {
      setThreadError(errorMessage(error, "Your reply could not be posted."))
    } finally {
      setPostingReply(false)
    }
  }

  function updateReply(updated: CommunityReply) {
    setReplies((current) => current.map((reply) => (reply.id === updated.id ? updated : reply)))
  }

  function markReplyDeleted(replyId: string) {
    const nextReplies = replies.map((reply) => (
      reply.id === replyId
        ? {
            ...reply,
            body: "",
            status: "deleted" as const,
            author: { id: "", displayName: "StoryTuner member", username: "member" },
            mine: false,
            likeCount: 0,
            likedByViewer: false,
          }
        : reply
    ))
    setReplies(nextReplies)
    // Count every active comment that still has a visible ancestry. If a parent
    // disappears, its nested descendants stop counting immediately too.
    const nextReplyCount = countActiveRenderableReplies(nextReplies.map((reply) => ({
      id: reply.id,
      parent_reply_id: reply.parentReplyId,
      status: reply.status,
    })))
    onUpdated({ ...post, replyCount: nextReplyCount })
    if (replyingTo?.id === replyId) setReplyingTo(null)
  }

  async function blockPostAuthor() {
    if (blocking) return
    setBlocking(true)
    setPostError("")
    try {
      const response = await fetch("/api/community/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ userId: post.author.id }),
      })
      const payload = await response.json() as { blocked?: boolean; error?: string }
      if (!response.ok || !payload.blocked) throw new Error(payload.error || "The member could not be blocked.")
      setBlockOpen(false)
      setNoticeTitle("Member blocked")
      setNotice("Their Community posts and replies are now hidden from you.")
    } catch (error) {
      setPostError(errorMessage(error, "The member could not be blocked."))
      setBlockOpen(false)
    } finally {
      setBlocking(false)
    }
  }

  function closePostNotice() {
    const refreshBlocks = noticeTitle === "Member blocked"
    setNotice("")
    if (refreshBlocks) window.dispatchEvent(new Event("storytuner:community-blocked"))
  }

  const replyAuthors = useMemo(() => new Map(replies.map((reply) => [reply.id, publicAuthorLabel(reply.author)])), [replies])
  const groupedReplies = useMemo(() => groupConversationReplies(replies), [replies])
  const menuItems: MenuItem[] = post.mine
    ? [
        ...(post.postType === "text" ? [{ label: "Edit post", icon: Pencil, onSelect: () => setEditing(true) } satisfies MenuItem] : []),
        { label: "Delete post", icon: Trash2, tone: "danger", onSelect: () => setDeleteOpen(true) },
      ]
    : [
        { label: "Report post", icon: Flag, tone: "danger", onSelect: () => setReportOpen(true) },
        { label: "Block member", icon: Ban, tone: "danger", onSelect: () => setBlockOpen(true) },
      ]

  return (
    <article id={post.id} className="app-surface scroll-mt-24 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{publicAuthorLabel(post.author)}</p>
          <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
            {relativeDate(post.createdAt)}{post.editedAt ? " · edited" : ""}
          </p>
        </div>
        <ActionMenu label="Post options" items={menuItems} />
      </div>

      {post.title && <h3 className="mt-4 text-base font-semibold">{post.title}</h3>}

      {editing ? (
        <div className="mt-4">
          <textarea
            value={editDraft}
            maxLength={5000}
            rows={4}
            onChange={(event) => setEditDraft(event.target.value)}
            className="w-full resize-y rounded-2xl border border-brand bg-background px-4 py-3 text-sm leading-6 outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <CharacterCount value={editDraft.length} maximum={5000} warningAt={4500} />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setEditing(false); setEditDraft(post.body) }} disabled={savingEdit} className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground">Cancel</button>
              <button type="button" onClick={savePostEdit} disabled={!editDraft.trim() || savingEdit} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                {savingEdit ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {post.body && <p className="whitespace-pre-wrap text-[0.95rem] leading-7 text-foreground/90 text-pretty">{post.body}</p>}
          {post.hasAudio && <CommunityAudioPlayer postId={post.id} durationSeconds={post.audioDurationSeconds} onMembershipRequired={onMembershipRequired} />}
          {post.sharedTranscript && <SharedTranscript transcript={post.sharedTranscript} defaultOpen={post.postType === "transcript"} />}
        </div>
      )}

      {postError && <p className="mt-3 text-xs text-destructive" role="alert">{postError}</p>}

      {!editing && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={togglePostLike}
            disabled={liking}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
              post.likedByViewer ? "bg-rose-50 text-rose-700" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            aria-pressed={post.likedByViewer}
          >
            {liking ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Heart className="h-3.5 w-3.5" fill={post.likedByViewer ? "currentColor" : "none"} />}
            {post.likeCount}
          </button>
          <button
            type="button"
            onClick={() => void toggleThread()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-expanded={threadOpen}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {post.replyCount === 0 ? "Respond" : `${post.replyCount} ${post.replyCount === 1 ? "response" : "responses"}`}
            {threadOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {threadOpen && (
        <div className="mt-3 border-t border-border pt-4">
          {threadLoading && !threadLoaded ? (
            <div className="flex items-center py-4 text-xs text-muted-foreground"><LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading responses…</div>
          ) : threadError && !threadLoaded ? (
            <div className="rounded-2xl border border-destructive/25 px-4 py-4">
              <p className="text-xs text-destructive">{threadError}</p>
              <button type="button" onClick={() => void loadReplies()} className="mt-2 text-xs font-semibold">Try again</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {threadError && <p className="text-xs text-destructive" role="alert">{threadError}</p>}
              {groupedReplies.slice(0, visibleThreadCount).map(({ root, children }) => (
                <ReplyThreadGroup
                  key={root.id}
                  root={root}
                  children={children}
                  replyAuthors={replyAuthors}
                  onReply={beginReply}
                  onUpdated={updateReply}
                  onDeleted={markReplyDeleted}
                  onMembershipRequired={onMembershipRequired}
                  onModerationHeld={(message) => { setNoticeTitle("Held for review"); setNotice(message) }}
                  autoRevealReplyId={newestReplyId}
                />
              ))}

              {groupedReplies.length > visibleThreadCount && (
                <button
                  type="button"
                  onClick={() => setVisibleThreadCount((count) => count + 4)}
                  className="mx-auto rounded-full px-4 py-2 text-xs font-semibold text-brand hover:bg-brand-soft/60"
                >
                  See {Math.min(4, groupedReplies.length - visibleThreadCount)} more responses
                </button>
              )}

              <div className="rounded-2xl border border-border bg-background p-3">
                {replyingTo && (
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2">
                    <p className="text-xs text-muted-foreground">Replying to <span className="font-semibold text-foreground">{publicAuthorLabel(replyingTo.author)}</span></p>
                    <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply target"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                )}
                <textarea
                  ref={replyComposerRef}
                  value={replyDraft}
                  maxLength={2000}
                  rows={2}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder={replyingTo ? "Write a reply…" : "Add a thoughtful response…"}
                  className="w-full resize-y bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <CharacterCount value={replyDraft.length} maximum={2000} warningAt={1800} />
                  <button type="button" onClick={submitReply} disabled={!replyDraft.trim() || postingReply} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                    {postingReply ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Reply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this post?"
        confirmLabel="Delete post"
        tone="danger"
        busy={deleting}
        onCancel={() => { if (!deleting) setDeleteOpen(false) }}
        onConfirm={() => void deletePost()}
      >
        The post and its visible conversation will be removed from Community. This cannot be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={blockOpen}
        title="Block this member?"
        confirmLabel="Block member"
        tone="danger"
        busy={blocking}
        onCancel={() => { if (!blocking) setBlockOpen(false) }}
        onConfirm={() => void blockPostAuthor()}
      >
        Their Community posts and replies will be hidden from you, and your Community content will be hidden from them.
      </ConfirmDialog>

      <ReportDialog
        open={reportOpen}
        target="post"
        targetId={post.id}
        onCancel={() => setReportOpen(false)}
        onReported={(message) => { setReportOpen(false); setNoticeTitle("Report received"); setNotice(message) }}
      />

      <NoticeDialog open={Boolean(notice)} title={noticeTitle} onClose={closePostNotice}>{notice}</NoticeDialog>
    </article>
  )
}

function SharedTranscript({ transcript, defaultOpen }: { transcript: string; defaultOpen: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-2xl border border-border bg-secondary/35 px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> Transcript
      </summary>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{transcript}</p>
    </details>
  )
}

function CommunityAudioPlayer({ postId, durationSeconds, onMembershipRequired }: { postId: string; durationSeconds: number | null; onMembershipRequired: () => void }) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(durationSeconds && durationSeconds > 0 ? durationSeconds : 0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function loadAudio() {
    if (url || loading) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/community/posts/${postId}/audio`, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } })
      const payload = (await response.json()) as { url?: string; error?: string }
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (!response.ok || !payload.url) throw new Error(payload.error || "Shared audio could not be loaded.")
      setCurrentTime(0)
      setPlaying(false)
      setUrl(payload.url)
    } catch (audioError) {
      setError(errorMessage(audioError, "Shared audio could not be loaded."))
    } finally {
      setLoading(false)
    }
  }

  function syncDuration(audio: HTMLAudioElement) {
    const next = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (durationSeconds ?? 0)
    if (next > 0) setMediaDuration(next)
  }

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setError("Audio could not start. Try again.")
      }
    } else {
      audio.pause()
    }
  }

  function seek(value: number) {
    const audio = audioRef.current
    if (!audio || mediaDuration <= 0) return
    const next = Math.min(Math.max(value, 0), mediaDuration)
    audio.currentTime = next
    setCurrentTime(next)
  }

  const displayDuration = mediaDuration > 0 ? mediaDuration : (durationSeconds ?? 0)
  const safeCurrent = displayDuration > 0 ? Math.min(currentTime, displayDuration) : 0
  const progressPercent = displayDuration > 0 ? Math.min(100, Math.max(0, (safeCurrent / displayDuration) * 100)) : 0

  return (
    <div className="rounded-2xl border border-border bg-secondary/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background"><Headphones className="h-4 w-4" /></span>
          <div><p className="text-xs font-semibold">Shared audio</p>{displayDuration > 0 ? <p className="text-[0.68rem] text-muted-foreground">{formatCommunityDuration(displayDuration)}</p> : null}</div>
        </div>
        {!url && <button type="button" onClick={() => void loadAudio()} disabled={loading} className="rounded-full bg-background px-3 py-2 text-xs font-semibold disabled:opacity-50">{loading ? "Loading…" : "Load audio"}</button>}
      </div>

      {url && (
        <div className="mt-3 rounded-2xl bg-background/80 px-3 py-3">
          <audio
            ref={audioRef}
            preload="metadata"
            src={url}
            className="hidden"
            onLoadedMetadata={(event) => syncDuration(event.currentTarget)}
            onDurationChange={(event) => syncDuration(event.currentTarget)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setCurrentTime(displayDuration) }}
          />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void togglePlayback()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label={playing ? "Pause audio" : "Play audio"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <span className="w-[4.6rem] shrink-0 text-xs font-medium tabular-nums text-foreground/80">{formatCommunityDuration(safeCurrent)} / {formatCommunityDuration(displayDuration)}</span>
            <div className="relative min-w-0 flex-1">
              <div className="relative h-1.5 rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${progressPercent}%` }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm transition-[left] duration-100" style={{ left: `${progressPercent}%` }} aria-hidden="true" />
              </div>
              <input
                type="range"
                min={0}
                max={displayDuration > 0 ? displayDuration : 1}
                step={0.1}
                value={safeCurrent}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="Audio progress"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}

function formatCommunityDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`
}

type ReplyThreadGroupProps = {
  root: CommunityReply
  children: CommunityReply[]
  replyAuthors: Map<string, string>
  onReply: (reply: CommunityReply) => void
  onUpdated: (reply: CommunityReply) => void
  onDeleted: (replyId: string) => void
  onMembershipRequired: () => void
  onModerationHeld: (message: string) => void
  autoRevealReplyId: string | null
}

function ReplyThreadGroup({ root, children, replyAuthors, onReply, onUpdated, onDeleted, onMembershipRequired, onModerationHeld, autoRevealReplyId }: ReplyThreadGroupProps) {
  const [childrenOpen, setChildrenOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(4)
  const activeChildren = children.filter((reply) => reply.status === "active")
  const visibleChildren = activeChildren.slice(0, visibleCount)
  const remaining = Math.max(0, activeChildren.length - visibleCount)

  useEffect(() => {
    if (!autoRevealReplyId) return
    const index = children.findIndex((reply) => reply.id === autoRevealReplyId)
    if (index < 0) return
    setChildrenOpen(true)
    setVisibleCount(Math.max(4, index + 1))
  }, [autoRevealReplyId, children])

  return (
    <div className="flex flex-col gap-2">
      <ReplyCard
        reply={root}
        parentAuthor={null}
        onReply={() => onReply(root)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
        onMembershipRequired={onMembershipRequired}
        onModerationHeld={onModerationHeld}
      />

      {activeChildren.length > 0 && !childrenOpen && (
        <button
          type="button"
          onClick={() => { setChildrenOpen(true); setVisibleCount(4) }}
          className="ml-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold text-brand hover:bg-brand-soft/60 sm:ml-7"
        >
          <MessageCircle className="h-3.5 w-3.5" /> See {activeChildren.length} {activeChildren.length === 1 ? "reply" : "replies"}
        </button>
      )}

      {childrenOpen && (
        <div className="ml-4 flex flex-col gap-2 border-l border-brand/20 pl-3 sm:ml-7 sm:pl-4">
          {visibleChildren.map((reply) => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              parentAuthor={reply.parentReplyId ? replyAuthors.get(reply.parentReplyId) ?? "another member" : null}
              onReply={() => onReply(reply)}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onMembershipRequired={onMembershipRequired}
              onModerationHeld={onModerationHeld}
              nested
            />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {remaining > 0 && (
              <button type="button" onClick={() => setVisibleCount((count) => count + 4)} className="rounded-full px-3 py-1.5 text-[0.7rem] font-semibold text-brand hover:bg-brand-soft/60">
                See {Math.min(4, remaining)} more
              </button>
            )}
            <button type="button" onClick={() => { setChildrenOpen(false); setVisibleCount(4) }} className="rounded-full px-3 py-1.5 text-[0.7rem] font-semibold text-muted-foreground hover:bg-secondary">
              Hide replies
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function groupConversationReplies(replies: CommunityReply[]) {
  const byId = new Map(replies.map((reply) => [reply.id, reply]))
  const roots = replies.filter((reply) => !reply.parentReplyId)
  const childrenByRoot = new Map<string, CommunityReply[]>()

  for (const reply of replies) {
    if (!reply.parentReplyId) continue
    let cursor: CommunityReply | undefined = reply
    const visited = new Set<string>()
    while (cursor?.parentReplyId && !visited.has(cursor.id)) {
      visited.add(cursor.id)
      const parent = byId.get(cursor.parentReplyId)
      if (!parent) break
      cursor = parent
    }
    const rootId = cursor && !cursor.parentReplyId ? cursor.id : reply.parentReplyId
    const bucket = childrenByRoot.get(rootId) ?? []
    bucket.push(reply)
    childrenByRoot.set(rootId, bucket)
  }

  return roots
    .map((root) => ({
      root,
      children: (childrenByRoot.get(root.id) ?? []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }))
    .filter(({ root, children }) => root.status === "active" || children.some((reply) => reply.status === "active"))
}

type ReplyCardProps = {
  reply: CommunityReply
  parentAuthor: string | null
  onReply: () => void
  onUpdated: (reply: CommunityReply) => void
  onDeleted: (replyId: string) => void
  onMembershipRequired: () => void
  onModerationHeld: (message: string) => void
  nested?: boolean
}

function ReplyCard({ reply, parentAuthor, onReply, onUpdated, onDeleted, onMembershipRequired, onModerationHeld, nested = false }: ReplyCardProps) {
  const [liking, setLiking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(reply.body)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [notice, setNotice] = useState("")
  const [noticeTitle, setNoticeTitle] = useState("Report received")
  const [error, setError] = useState("")

  if (reply.status !== "active") {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-3">
        <p className="text-xs italic text-muted-foreground">Reply deleted.</p>
      </div>
    )
  }

  async function toggleLike() {
    if (liking) return
    setLiking(true)
    setError("")
    try {
      const response = await fetch(`/api/community/replies/${reply.id}/like`, {
        method: reply.likedByViewer ? "DELETE" : "POST",
        headers: { Accept: "application/json" },
      })
      const payload = (await response.json()) as { likedByViewer?: boolean; likeCount?: number } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) { onMembershipRequired(); return }
      if (!response.ok || typeof payload.likedByViewer !== "boolean" || typeof payload.likeCount !== "number") {
        throw new Error(payload.error || "The like could not be updated.")
      }
      onUpdated({ ...reply, likedByViewer: payload.likedByViewer, likeCount: payload.likeCount })
    } catch (caught) {
      setError(errorMessage(caught, "The like could not be updated."))
    } finally {
      setLiking(false)
    }
  }

  async function saveEdit() {
    const body = editDraft.trim()
    if (!body || saving) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/community/replies/${reply.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body }),
      })
      const payload = (await response.json()) as { reply?: CommunityReply; heldForReview?: boolean; message?: string } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) { onMembershipRequired(); return }
      if (response.ok && payload.heldForReview) {
        setEditing(false)
        onModerationHeld(payload.message || "This edit is being held for moderator review and is no longer visible to other members.")
        onDeleted(reply.id)
        return
      }
      if (!response.ok || !payload.reply) throw new Error(payload.error || "The reply could not be updated.")
      onUpdated(payload.reply)
      setEditing(false)
    } catch (caught) {
      setError(errorMessage(caught, "The reply could not be updated."))
    } finally {
      setSaving(false)
    }
  }

  async function deleteReply() {
    if (deleting) return
    setDeleting(true)
    setError("")
    try {
      const response = await fetch(`/api/community/replies/${reply.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      })
      const payload = (await response.json()) as { deleted?: boolean } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) { onMembershipRequired(); return }
      if (!response.ok || !payload.deleted) throw new Error(payload.error || "The reply could not be deleted.")
      setDeleteOpen(false)
      onDeleted(reply.id)
    } catch (caught) {
      setError(errorMessage(caught, "The reply could not be deleted."))
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  async function blockReplyAuthor() {
    if (blocking) return
    setBlocking(true)
    setError("")
    try {
      const response = await fetch("/api/community/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ userId: reply.author.id }),
      })
      const payload = await response.json() as { blocked?: boolean; error?: string }
      if (!response.ok || !payload.blocked) throw new Error(payload.error || "The member could not be blocked.")
      setBlockOpen(false)
      setNoticeTitle("Member blocked")
      setNotice("Their Community posts and replies are now hidden from you.")
    } catch (caught) {
      setError(errorMessage(caught, "The member could not be blocked."))
      setBlockOpen(false)
    } finally {
      setBlocking(false)
    }
  }

  function closeReplyNotice() {
    const refreshBlocks = noticeTitle === "Member blocked"
    setNotice("")
    if (refreshBlocks) window.dispatchEvent(new Event("storytuner:community-blocked"))
  }

  const menuItems: MenuItem[] = reply.mine
    ? [
        { label: "Edit reply", icon: Pencil, onSelect: () => setEditing(true) },
        { label: "Delete reply", icon: Trash2, tone: "danger", onSelect: () => setDeleteOpen(true) },
      ]
    : [
        { label: "Report reply", icon: Flag, tone: "danger", onSelect: () => setReportOpen(true) },
        { label: "Block member", icon: Ban, tone: "danger", onSelect: () => setBlockOpen(true) },
      ]

  return (
    <div className={cn("rounded-2xl bg-secondary/45 px-4 py-3 transition-colors", nested && "bg-secondary/30")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{publicAuthorLabel(reply.author)}</p>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {parentAuthor ? `Replying to ${parentAuthor} · ` : ""}{relativeDate(reply.createdAt)}{reply.editedAt ? " · edited" : ""}
          </p>
        </div>
        <ActionMenu label="Reply options" items={menuItems} compact />
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea value={editDraft} maxLength={2000} rows={3} onChange={(event) => setEditDraft(event.target.value)} className="w-full resize-y rounded-xl border border-brand bg-background px-3 py-2 text-sm leading-6 outline-none" />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setEditDraft(reply.body) }} disabled={saving} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground">Cancel</button>
            <button type="button" onClick={saveEdit} disabled={!editDraft.trim() || saving} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
              {saving && <LoaderCircle className="h-3 w-3 animate-spin" />} Save
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{reply.body}</p>
      )}

      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}

      {!editing && (
        <div className="mt-2 flex items-center gap-1">
          <button type="button" onClick={toggleLike} disabled={liking} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.68rem] font-semibold disabled:opacity-50", reply.likedByViewer ? "bg-rose-50 text-rose-700" : "text-muted-foreground hover:bg-background")} aria-pressed={reply.likedByViewer}>
            {liking ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Heart className="h-3 w-3" fill={reply.likedByViewer ? "currentColor" : "none"} />} {reply.likeCount}
          </button>
          <button type="button" onClick={onReply} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.68rem] font-semibold text-muted-foreground hover:bg-background">
            <CornerUpLeft className="h-3 w-3" /> Reply
          </button>
        </div>
      )}

      <ConfirmDialog open={deleteOpen} title="Delete this reply?" confirmLabel="Delete reply" tone="danger" busy={deleting} onCancel={() => { if (!deleting) setDeleteOpen(false) }} onConfirm={() => void deleteReply()}>
        The reply will be replaced with a deleted placeholder so the rest of the conversation still makes sense. This cannot be undone.
      </ConfirmDialog>

      <ConfirmDialog open={blockOpen} title="Block this member?" confirmLabel="Block member" tone="danger" busy={blocking} onCancel={() => { if (!blocking) setBlockOpen(false) }} onConfirm={() => void blockReplyAuthor()}>
        Their Community posts and replies will be hidden from you, and your Community content will be hidden from them.
      </ConfirmDialog>

      <ReportDialog open={reportOpen} target="reply" targetId={reply.id} onCancel={() => setReportOpen(false)} onReported={(message) => { setReportOpen(false); setNoticeTitle("Report received"); setNotice(message) }} />
      <NoticeDialog open={Boolean(notice)} title={noticeTitle} onClose={closeReplyNotice}>{notice}</NoticeDialog>
    </div>
  )
}

function ActionMenu({ label, items, compact = false }: { label: string; items: MenuItem[]; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", closeOutside)
    window.addEventListener("keydown", closeEscape)
    return () => {
      document.removeEventListener("mousedown", closeOutside)
      window.removeEventListener("keydown", closeEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={label} aria-expanded={open} className={cn("inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground", compact ? "h-7 w-7" : "h-8 w-8")}>
        <MoreHorizontal className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-30 min-w-40 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-[0_16px_40px_rgba(37,32,27,0.14)]">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => { setOpen(false); item.onSelect() }}
                className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition", item.tone === "danger" ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-secondary")}
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReportDialog({
  open,
  target,
  targetId,
  onCancel,
  onReported,
}: {
  open: boolean
  target: "post" | "reply"
  targetId: string
  onCancel: () => void
  onReported: (message: string) => void
}) {
  const [reason, setReason] = useState<CommunityReportReason>("harassment")
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      setReason("harassment")
      setDetails("")
      setError("")
    }
  }, [open])

  async function submit() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          postId: target === "post" ? targetId : null,
          replyId: target === "reply" ? targetId : null,
          reason,
          details,
        }),
      })
      const payload = await response.json() as { reported?: boolean; alreadyReported?: boolean; error?: string }
      if (!response.ok || !payload.reported) throw new Error(payload.error || "The report could not be submitted.")
      onReported(payload.alreadyReported ? "You already reported this content. The original report is still open for review." : "Thank you. The report was submitted privately for review.")
    } catch (caught) {
      setError(errorMessage(caught, "The report could not be submitted."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open={open} title={`Report this ${target}?`} confirmLabel="Submit report" tone="brand" busy={busy} onCancel={onCancel} onConfirm={() => void submit()}>
      <p>Reports are private. The person who posted this will not see who submitted the report.</p>
      <label className="mt-4 block">
        <span className="text-xs font-semibold text-foreground">Reason</span>
        <div className="relative mt-2">
          <select value={reason} onChange={(event) => setReason(event.target.value as CommunityReportReason)} className="w-full appearance-none rounded-xl border border-border bg-background py-2.5 pl-3 pr-16 text-sm text-foreground outline-none focus:border-brand">
            {reportReasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <span className="pointer-events-none absolute right-7 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <ChevronDown className="h-4 w-4" strokeWidth={2.3} />
          </span>
        </div>
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-foreground">Optional details</span>
        <textarea value={details} maxLength={1000} rows={3} onChange={(event) => setDetails(event.target.value)} placeholder="Add context that would help a moderator…" className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-5 text-foreground outline-none focus:border-brand" />
      </label>
      {error && <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>}
    </ConfirmDialog>
  )
}

function CharacterCount({ value, maximum, warningAt }: { value: number; maximum: number; warningAt: number }) {
  return <span className={cn("font-mono text-[0.65rem]", value > warningAt ? "text-destructive" : "text-muted-foreground")}>{value}/{maximum}</span>
}

function publicAuthorLabel(author: CommunityAuthor) {
  const username = author.username?.trim()
  if (username && username !== "member") return `@${username}`
  return author.displayName?.trim() || "StoryTuner member"
}

function rankPosts(posts: CommunityFeedPost[]) {
  return [...posts].sort((a, b) => {
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function mergePosts(current: CommunityFeedPost[], incoming: CommunityFeedPost[]) {
  const seen = new Set(current.map((post) => post.id))
  return [...current, ...incoming.filter((post) => !seen.has(post.id))]
}

function isMembershipDenial(response: Response, payload: ApiErrorPayload) {
  return response.status === 403 && payload.error?.toLowerCase().includes("membership")
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
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

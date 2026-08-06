"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  Heart,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import type {
  CommunityFeedPost,
  CommunityFeedResponse,
  CommunityRepliesResponse,
  CommunityReply,
} from "@/lib/community/types"
import { cn } from "@/lib/utils"

type CommunityClientProps = {
  membershipActive: boolean
  currentDisplayName: string
}

type ApiErrorPayload = { error?: string }

export function CommunityClient({ membershipActive, currentDisplayName }: CommunityClientProps) {
  if (!membershipActive) return <MembershipLock />
  return <MemberCommunity currentDisplayName={currentDisplayName} />
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
      const payload = (await response.json()) as CommunityFeedResponse & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        setMembershipRequired(true)
        return
      }
      if (!response.ok) throw new Error(payload.error || "Community posts could not be loaded.")

      setPosts((current) => (replace ? payload.posts : mergePosts(current, payload.posts)))
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
      const payload = (await response.json()) as { post?: CommunityFeedPost } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        setMembershipRequired(true)
        return
      }
      if (!response.ok || !payload.post) {
        throw new Error(payload.error || "Your post could not be published.")
      }

      setFeedError("")
      setLoading(false)
      setPosts((current) => [payload.post!, ...current.filter((post) => post.id !== payload.post!.id)])
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
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)))
  }

  function deletePost(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId))
  }

  if (membershipRequired) return <MembershipLock />

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Community</Eyebrow>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/70 px-3 py-1.5 text-[0.7rem] font-semibold text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Membership active
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">Stories shared on purpose.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground text-pretty">
          Share something you are shaping, then read and respond to work from other StoryTuner members.
          Nothing from your Story Reel is posted unless you choose to share it.
        </p>
        <div className="mt-5 border-l-2 border-brand/50 pl-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Community principle</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
            Respond to what landed. Lead with curiosity instead of correction.
          </p>
        </div>
      </header>

      <section aria-labelledby="share-heading" className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Start a conversation</p>
            <h2 id="share-heading" className="mt-1 text-lg font-semibold">Share with Community</h2>
            <p className="mt-1 text-xs text-muted-foreground">Posting as {currentDisplayName}</p>
          </div>
          <CharacterCount value={draft.length} maximum={5000} warningAt={4500} />
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
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted-foreground">Text posts are visible to paid Community members.</p>
          <button
            type="button"
            onClick={publishPost}
            disabled={!draft.trim() || publishing}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </section>

      <section
        id="community-feed"
        aria-labelledby="community-feed-heading"
        aria-live="polite"
        className="scroll-mt-20 border-t border-border pt-7"
      >
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Community feed</Eyebrow>
            <h2 id="community-feed-heading" className="mt-2 text-xl font-semibold tracking-tight">Latest from the Community</h2>
            <p className="mt-1 text-sm text-muted-foreground">Stories and reflections shared by members, newest first.</p>
          </div>
          {!loading && !feedError && posts.length > 0 && (
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-[0.65rem] font-semibold text-muted-foreground">
              {posts.length} shown
            </span>
          )}
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
            <p className="mt-1 text-sm text-muted-foreground">Your first text post can begin the Community.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feedError && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">The latest refresh failed, but your loaded posts are still shown.</p>
                <button
                  type="button"
                  onClick={() => void loadPage(0, true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold"
                >
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
    </div>
  )
}

function FeedError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-destructive/30 bg-card px-6 py-8 text-center">
      <p className="text-sm font-semibold">Community feed could not load.</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold"
      >
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
}

function PostCard({ post, onUpdated, onDeleted, onMembershipRequired }: PostCardProps) {
  const [liking, setLiking] = useState(false)
  const [postError, setPostError] = useState("")
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(post.body)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)
  const [threadLoaded, setThreadLoaded] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState("")
  const [replies, setReplies] = useState<CommunityReply[]>([])
  const [replyDraft, setReplyDraft] = useState("")
  const [replyingTo, setReplyingTo] = useState<CommunityReply | null>(null)
  const [postingReply, setPostingReply] = useState(false)
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
      const payload = (await response.json()) as {
        likedByViewer?: boolean
        likeCount?: number
      } & ApiErrorPayload
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
      const payload = (await response.json()) as { post?: CommunityFeedPost } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
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
    if (deleting || !window.confirm("Delete this post? Its replies will no longer be visible.")) return
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
      onDeleted(post.id)
    } catch (error) {
      setPostError(errorMessage(error, "The post could not be deleted."))
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
      setThreadLoaded(true)
    } catch (error) {
      setThreadError(errorMessage(error, "Replies could not be loaded."))
    } finally {
      setThreadLoading(false)
    }
  }

  async function toggleThread() {
    const nextOpen = !threadOpen
    setThreadOpen(nextOpen)
    if (nextOpen && !threadLoaded && !threadLoading) await loadReplies()
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
      const payload = (await response.json()) as { reply?: CommunityReply } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Your reply could not be posted.")

      setReplies((current) => [...current, payload.reply!])
      setThreadLoaded(true)
      setReplyDraft("")
      setReplyingTo(null)
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
    setReplies((current) => current.map((reply) => (
      reply.id === replyId
        ? {
            ...reply,
            body: "",
            status: "deleted",
            author: { id: "", displayName: "StoryTuner member", username: "member" },
            mine: false,
            likeCount: 0,
            likedByViewer: false,
          }
        : reply
    )))
    onUpdated({ ...post, replyCount: Math.max(0, post.replyCount - 1) })
    if (replyingTo?.id === replyId) setReplyingTo(null)
  }

  const replyAuthors = useMemo(
    () => new Map(replies.map((reply) => [reply.id, reply.author.displayName])),
    [replies],
  )

  return (
    <article id={post.id} className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{post.author.displayName}</p>
          <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
            Text post · {relativeDate(post.createdAt)}{post.editedAt ? " · edited" : ""}
          </p>
        </div>
        {post.mine && (
          <div className="flex items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Edit post"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={deletePost}
              disabled={deleting}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              aria-label="Delete post"
            >
              {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {post.title && <h3 className="mt-4 text-base font-semibold">{post.title}</h3>}

      {editing ? (
        <div className="mt-4">
          <textarea
            value={editDraft}
            maxLength={5000}
            rows={5}
            onChange={(event) => setEditDraft(event.target.value)}
            className="w-full resize-y rounded-2xl border border-brand bg-background px-4 py-3 text-sm leading-6 outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <CharacterCount value={editDraft.length} maximum={5000} warningAt={4500} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setEditDraft(post.body)
                }}
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={savePostEdit}
                disabled={!editDraft.trim() || savingEdit}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                {savingEdit ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-7 text-foreground/90 text-pretty">{post.body}</p>
      )}

      {postError && <p className="mt-3 text-xs text-destructive" role="alert">{postError}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={togglePostLike}
          disabled={liking}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
            post.likedByViewer ? "bg-rose-50 text-rose-700" : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={post.likedByViewer}
        >
          {liking ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Heart className="h-3.5 w-3.5" fill={post.likedByViewer ? "currentColor" : "none"} />
          )}
          {post.likeCount}
        </button>
        <button
          type="button"
          onClick={() => void toggleThread()}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-expanded={threadOpen}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
          {threadOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => beginReply(null)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <CornerUpLeft className="h-3.5 w-3.5" /> Reply
        </button>
      </div>

      {threadOpen && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Conversation</p>
            {threadLoaded && (
              <button
                type="button"
                onClick={() => void loadReplies()}
                disabled={threadLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", threadLoading && "animate-spin")} /> Refresh
              </button>
            )}
          </div>

          {threadLoading && !threadLoaded ? (
            <div className="flex items-center py-5 text-xs text-muted-foreground">
              <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading replies…
            </div>
          ) : threadError && !threadLoaded ? (
            <div className="rounded-2xl border border-destructive/25 px-4 py-4">
              <p className="text-xs text-destructive">{threadError}</p>
              <button type="button" onClick={() => void loadReplies()} className="mt-2 text-xs font-semibold">Try again</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {threadError && <p className="text-xs text-destructive" role="alert">{threadError}</p>}
              {replies.length === 0 ? (
                <p className="rounded-2xl bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
                  No replies yet. Add the first thoughtful response.
                </p>
              ) : (
                replies.map((reply) => (
                  <ReplyCard
                    key={reply.id}
                    reply={reply}
                    parentAuthor={reply.parentReplyId ? replyAuthors.get(reply.parentReplyId) ?? "another member" : null}
                    onReply={() => beginReply(reply)}
                    onUpdated={updateReply}
                    onDeleted={markReplyDeleted}
                    onMembershipRequired={onMembershipRequired}
                  />
                ))
              )}

              <div className="mt-1 rounded-2xl border border-border bg-background p-3">
                {replyingTo && (
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Replying to <span className="font-semibold text-foreground">{replyingTo.author.displayName}</span>
                    </p>
                    <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply target">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                )}
                <textarea
                  ref={replyComposerRef}
                  value={replyDraft}
                  maxLength={2000}
                  rows={3}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder={replyingTo ? "Write a reply…" : "Add a thoughtful response…"}
                  className="w-full resize-y bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <CharacterCount value={replyDraft.length} maximum={2000} warningAt={1800} />
                  <button
                    type="button"
                    onClick={submitReply}
                    disabled={!replyDraft.trim() || postingReply}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {postingReply ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Post reply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

type ReplyCardProps = {
  reply: CommunityReply
  parentAuthor: string | null
  onReply: () => void
  onUpdated: (reply: CommunityReply) => void
  onDeleted: (replyId: string) => void
  onMembershipRequired: () => void
}

function ReplyCard({ reply, parentAuthor, onReply, onUpdated, onDeleted, onMembershipRequired }: ReplyCardProps) {
  const [liking, setLiking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(reply.body)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  if (reply.status !== "active") {
    return (
      <div className={cn("rounded-2xl border border-dashed border-border px-4 py-3", reply.parentReplyId && "ml-5 sm:ml-8")}>
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
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
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
      const payload = (await response.json()) as { reply?: CommunityReply } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
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
    if (deleting || !window.confirm("Delete this reply?")) return
    setDeleting(true)
    setError("")
    try {
      const response = await fetch(`/api/community/replies/${reply.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      })
      const payload = (await response.json()) as { deleted?: boolean } & ApiErrorPayload
      if (isMembershipDenial(response, payload)) {
        onMembershipRequired()
        return
      }
      if (!response.ok || !payload.deleted) throw new Error(payload.error || "The reply could not be deleted.")
      onDeleted(reply.id)
    } catch (caught) {
      setError(errorMessage(caught, "The reply could not be deleted."))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={cn("rounded-2xl bg-secondary/45 px-4 py-3", reply.parentReplyId && "ml-5 border-l-2 border-brand/30 sm:ml-8")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{reply.author.displayName}</p>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {parentAuthor ? `Replying to ${parentAuthor} · ` : ""}{relativeDate(reply.createdAt)}{reply.editedAt ? " · edited" : ""}
          </p>
        </div>
        {reply.mine && (
          <div className="flex items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background"
                aria-label="Edit reply"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={deleteReply}
              disabled={deleting}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              aria-label="Delete reply"
            >
              {deleting ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            value={editDraft}
            maxLength={2000}
            rows={3}
            onChange={(event) => setEditDraft(event.target.value)}
            className="w-full resize-y rounded-xl border border-brand bg-background px-3 py-2 text-sm leading-6 outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setEditDraft(reply.body)
              }}
              disabled={saving}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={!editDraft.trim() || saving}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {saving && <LoaderCircle className="h-3 w-3 animate-spin" />} Save
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{reply.body}</p>
      )}

      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}

      {!editing && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLike}
            disabled={liking}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.68rem] font-semibold disabled:opacity-50",
              reply.likedByViewer ? "bg-rose-50 text-rose-700" : "text-muted-foreground hover:bg-background",
            )}
            aria-pressed={reply.likedByViewer}
          >
            {liking ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Heart className="h-3 w-3" fill={reply.likedByViewer ? "currentColor" : "none"} />}
            {reply.likeCount}
          </button>
          <button
            type="button"
            onClick={onReply}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.68rem] font-semibold text-muted-foreground hover:bg-background"
          >
            <CornerUpLeft className="h-3 w-3" /> Reply
          </button>
        </div>
      )}
    </div>
  )
}

function CharacterCount({ value, maximum, warningAt }: { value: number; maximum: number; warningAt: number }) {
  return (
    <span className={cn("font-mono text-[0.65rem]", value > warningAt ? "text-destructive" : "text-muted-foreground")}>
      {value}/{maximum}
    </span>
  )
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

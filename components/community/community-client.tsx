"use client"

import Link from "next/link"
import { useState, type ChangeEvent, type KeyboardEvent } from "react"
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { MediaPlayer } from "@/components/arena/media-player"
import { useApp, type CommunityPost } from "@/lib/app-state"
import { cn } from "@/lib/utils"

export function CommunityClient() {
  const { state, toggleHeart, addComment, removePost } = useApp()
  return (
    <div className="flex flex-col gap-6">
      <header>
        <Eyebrow>Community</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Stories shared on purpose.</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
          A calm space for specific, thoughtful responses. Nothing from your Story Reel appears here unless you share it.
        </p>
      </header>
      <section className="rounded-3xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Community principle</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Respond to what landed, not what you would have done differently. Curiosity is more useful than correction.</p>
      </section>
      <div className="flex flex-col gap-4">
        {state.community.map((post) => (
          <PostCard key={post.id} post={post} liked={state.likedPosts.includes(post.id)} onHeart={() => toggleHeart(post.id)} onComment={(text) => addComment(post.id, text)} onRemove={post.mine ? () => removePost(post.id) : undefined} canComment={state.premium} />
        ))}
      </div>
    </div>
  )
}

function PostCard({ post, liked, onHeart, onComment, onRemove, canComment }: { post: CommunityPost; liked: boolean; onHeart: () => void; onComment: (text: string) => void; onRemove?: () => void; canComment: boolean }) {
  const [comment, setComment] = useState("")
  function submit() {
    if (!canComment || !comment.trim()) return
    onComment(comment)
    setComment("")
  }
  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{post.author}</p>
          <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">{post.context} · {relativeDate(post.createdAt)}</p>
        </div>
        {onRemove && <button type="button" onClick={() => { if (window.confirm("Remove this story from Community?")) onRemove() }} className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-destructive" aria-label="Remove post"><Trash2 className="h-4 w-4" /></button>}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-7 text-foreground/90 text-pretty">{post.text}</p>
      {post.recordingId && <MediaPlayer recordingId={post.recordingId} kind={post.mediaKind} />}
      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <button type="button" onClick={onHeart} className={cn("flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors", liked ? "bg-streak-soft text-streak" : "bg-secondary text-muted-foreground hover:text-foreground")}>
          <Heart className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} />{post.hearts}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageCircle className="h-3.5 w-3.5" />{post.comments.length}</span>
      </div>
      {post.comments.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {post.comments.map((item) => <div key={item.id} className="rounded-2xl bg-secondary px-4 py-3 text-sm leading-relaxed"><strong className="mr-1">{item.author}</strong><span className="text-muted-foreground">{item.text}</span></div>)}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <input value={comment} disabled={!canComment} onChange={(event: ChangeEvent<HTMLInputElement>) => setComment(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") submit() }} placeholder={canComment ? "Share what landed…" : "Commenting is part of Plus"} className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60" />
        <button type="button" onClick={submit} disabled={!canComment || !comment.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Post comment"><Send className="h-4 w-4" /></button>
      </div>
      {!canComment && <Link href="/membership" className="mt-2 inline-flex text-xs font-semibold text-muted-foreground hover:text-foreground">Review Plus features</Link>}
    </article>
  )
}

function relativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

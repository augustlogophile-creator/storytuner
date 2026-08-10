export type CommunityPostType = "text" | "transcript" | "audio" | "audio_transcript"
export type CommunityContentStatus = "active" | "deleted" | "removed"

export type CommunityAuthor = {
  id: string
  displayName: string
  username: string
}

export type CommunityFeedPost = {
  id: string
  postType: CommunityPostType
  title: string | null
  body: string
  sharedTranscript: string | null
  hasAudio: boolean
  audioDurationSeconds: number | null
  createdAt: string
  editedAt: string | null
  author: CommunityAuthor
  likeCount: number
  replyCount: number
  likedByViewer: boolean
  mine: boolean
}

export type CommunityReply = {
  id: string
  postId: string
  parentReplyId: string | null
  body: string
  status: CommunityContentStatus
  createdAt: string
  editedAt: string | null
  author: CommunityAuthor
  likeCount: number
  likedByViewer: boolean
  mine: boolean
}

export type CommunityFeedResponse = {
  posts: CommunityFeedPost[]
  page: number
  hasMore: boolean
}

export type CommunityRepliesResponse = {
  replies: CommunityReply[]
  activeReplyCount: number
}

export type CommunityReportReason =
  | "harassment"
  | "hate"
  | "sexual_content"
  | "violence"
  | "self_harm"
  | "personal_information"
  | "spam"
  | "other"

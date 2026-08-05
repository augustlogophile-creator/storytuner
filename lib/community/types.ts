export type CommunityPostType = "text" | "transcript" | "audio" | "audio_transcript"

export type CommunityFeedPost = {
  id: string
  postType: CommunityPostType
  title: string | null
  body: string
  sharedTranscript: string | null
  createdAt: string
  editedAt: string | null
  author: {
    id: string
    displayName: string
    username: string
  }
  likeCount: number
  replyCount: number
  likedByViewer: boolean
  mine: boolean
}

export type CommunityFeedResponse = {
  posts: CommunityFeedPost[]
  page: number
  hasMore: boolean
}

import { auth } from "@clerk/nextjs/server"

export async function requireStoryTunerUser(returnBackUrl: string) {
  const { isAuthenticated, redirectToSignIn } = await auth()
  if (!isAuthenticated) return redirectToSignIn({ returnBackUrl })
}

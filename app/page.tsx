import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Onboarding } from "@/components/onboarding"
import { INTRO_SEEN_COOKIE } from "@/lib/intro-history"
import { signedInDestination } from "@/lib/require-auth"

type IntroductionSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function IntroductionPage({
  searchParams,
}: {
  searchParams?: IntroductionSearchParams
}) {
  const destination = await signedInDestination()
  if (destination) redirect(destination)

  const params = searchParams ? await searchParams : {}
  const replay = (Array.isArray(params.replay) ? params.replay[0] : params.replay) === "1"
  const accountDeleted = (Array.isArray(params.accountDeleted) ? params.accountDeleted[0] : params.accountDeleted) === "1"

  // Older builds sent successful account deletion back to /. Never make that
  // path replay the introduction. New builds route directly to sign-in.
  if (accountDeleted) redirect("/sign-up?mode=sign-in&accountDeleted=1")

  const cookieStore = await cookies()
  if (!replay && cookieStore.get(INTRO_SEEN_COOKIE)?.value === "1") {
    redirect("/sign-up?mode=sign-in")
  }

  const rawPage = Array.isArray(params.introPage) ? params.introPage[0] : params.introPage
  const parsedPage = Number.parseInt(rawPage ?? "0", 10)
  const initialPage = Number.isFinite(parsedPage) ? Math.max(0, Math.min(4, parsedPage)) : 0

  return <Onboarding initialPage={initialPage} />
}

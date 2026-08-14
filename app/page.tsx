import { redirect } from "next/navigation"
import { Onboarding } from "@/components/onboarding"
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
  const rawPage = Array.isArray(params.introPage) ? params.introPage[0] : params.introPage
  const parsedPage = Number.parseInt(rawPage ?? "0", 10)
  const initialPage = Number.isFinite(parsedPage) ? Math.max(0, Math.min(4, parsedPage)) : 0

  return <Onboarding initialPage={initialPage} />
}

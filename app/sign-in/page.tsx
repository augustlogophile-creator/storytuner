import { redirect } from "next/navigation"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const destination = new URLSearchParams()
  destination.set("mode", "sign-in")

  const next = Array.isArray(params.next) ? params.next[0] : params.next
  const error = Array.isArray(params.error) ? params.error[0] : params.error
  if (next) destination.set("next", next)
  if (error) destination.set("error", error)

  redirect(`/sign-up?${destination.toString()}`)
}

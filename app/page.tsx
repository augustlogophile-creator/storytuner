import { redirect } from "next/navigation"
import { Onboarding } from "@/components/onboarding"
import { signedInDestination } from "@/lib/require-auth"

export default async function IntroductionPage() {
  const destination = await signedInDestination()
  if (destination) redirect(destination)
  return <Onboarding />
}

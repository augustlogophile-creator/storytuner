import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { signedInDestination } from "@/lib/require-auth"

export default async function SignUpPage() {
  const destination = await signedInDestination()
  if (destination) redirect(destination)
  return (
    <AuthShell eyebrow="StoryTuner account" title="Create your StoryTuner account" copy="Create a secure account for your StoryTuner profile. Lesson progress and recordings still remain on this device for now.">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-secondary/50" />}><AuthForm mode="sign-up" /></Suspense>
    </AuthShell>
  )
}

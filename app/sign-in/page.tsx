import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { signedInDestination } from "@/lib/require-auth"

export default async function SignInPage() {
  const destination = await signedInDestination()
  if (destination) redirect(destination)
  return (
    <AuthShell eyebrow="StoryTuner account" title="Welcome back" copy="Continue your course, recordings, and personal storytelling coaching with Weaver.">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-secondary/50" />}><AuthForm mode="sign-in" /></Suspense>
    </AuthShell>
  )
}

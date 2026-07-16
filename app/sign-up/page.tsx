import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { signedInDestination } from "@/lib/require-auth"

export default async function SignUpPage() {
  const destination = await signedInDestination()
  if (destination) redirect(destination)
  return (
    <AuthShell
      eyebrow="StoryTuner account"
      title="Continue to StoryTuner"
      copy="Choose sign up or log in, then continue securely with Google."
    >
      <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-secondary/50" />}>
        <AuthForm initialMode="sign-up" />
      </Suspense>
    </AuthShell>
  )
}

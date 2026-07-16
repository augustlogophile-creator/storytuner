import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { signedInDestination } from "@/lib/require-auth"

export default async function SignUpPage() {
  const destination = await signedInDestination()
  if (destination) redirect(destination)
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-secondary/50" />}>
        <AuthForm initialMode="sign-up" />
      </Suspense>
    </AuthShell>
  )
}

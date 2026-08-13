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
      <Suspense fallback={<div className="auth-panel min-h-[22rem]" aria-hidden="true" />}>
        <AuthForm initialMode="sign-up" />
      </Suspense>
    </AuthShell>
  )
}

import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password" copy="Enter your email and Supabase will send a secure reset link.">
      <ForgotPasswordForm />
    </AuthShell>
  )
}

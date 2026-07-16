import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export default function ResetPasswordPage() {
  return (
    <AuthShell eyebrow="Account security" title="Choose a new password" copy="Use at least eight characters and choose something you do not reuse elsewhere.">
      <ResetPasswordForm />
    </AuthShell>
  )
}

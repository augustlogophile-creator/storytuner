import { redirect } from "next/navigation"

export default function ForgotPasswordPage() {
  redirect("/sign-up?mode=sign-in")
}

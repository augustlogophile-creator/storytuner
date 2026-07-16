import { redirect } from "next/navigation"

export default function ResetPasswordPage() {
  redirect("/sign-up?mode=sign-in")
}

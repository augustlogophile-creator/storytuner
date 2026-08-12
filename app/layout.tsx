import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { DM_Serif_Display, Manrope, Geist_Mono } from "next/font/google"
import { AppProviders } from "@/components/app-providers"
import { getMembershipByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700", "800"],
})
const editorial = DM_Serif_Display({ subsets: ["latin"], variable: "--font-editorial", weight: "400" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "StoryTuner · Learn the craft. Tell it well.",
  description: "A complete storytelling course, a private recording studio, and thoughtful coaching for true stories.",
  applicationName: "StoryTuner",
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f3f0",
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authenticated = await getAuthenticatedUser()
  let initialDisplayName = "Storyteller"
  let initialMembershipActive = false

  if (authenticated) {
    const [membership, profileResult] = await Promise.all([
      getMembershipByUserId(authenticated.id),
      authenticated.supabase
        .from("profiles")
        .select("display_name")
        .eq("id", authenticated.id)
        .maybeSingle<{ display_name: string }>(),
    ])
    initialMembershipActive = membership.active
    initialDisplayName = profileResult.data?.display_name?.trim() || "Storyteller"
  }

  return (
    <html lang="en" className={`light bg-background ${manrope.variable} ${editorial.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <AppProviders
          initialUserId={authenticated?.id ?? null}
          initialDisplayName={initialDisplayName}
          initialMembershipActive={initialMembershipActive}
        >
          {children}
        </AppProviders>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}

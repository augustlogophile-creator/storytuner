import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Handlee } from "next/font/google"
import { AppProviders } from "@/components/app-providers"
import { getMembershipByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const bookHand = Handlee({ subsets: ["latin"], weight: "400", variable: "--font-book-hand" })

export const metadata: Metadata = {
  title: "StoryTuner · Learn the craft. Tell it well.",
  description: "A complete storytelling course, a private recording studio, and thoughtful coaching for true stories.",
  applicationName: "StoryTuner",
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#faf8f2",
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
    <html lang="en" className={`light bg-background ${geistSans.variable} ${geistMono.variable} ${bookHand.variable}`}>
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

import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Handlee, Lora } from "next/font/google"
import { cookies } from "next/headers"
import { AppProviders } from "@/components/app-providers"
import { getMembershipByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const bookHand = Handlee({ subsets: ["latin"], weight: "400", variable: "--font-book-hand" })
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" })

export const metadata: Metadata = {
  title: "Tellwise · Learn the craft. Tell it well.",
  description: "A storytelling course, private Journal, recording studio, and thoughtful coaching for true stories.",
  applicationName: "Tellwise",
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#faf8f2",
  viewportFit: "cover",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authenticated = await getAuthenticatedUser()
  const cookieStore = await cookies()
  const initialTheme = authenticated && cookieStore.get("tellwise_theme")?.value === "dark" ? "dark" : "light"
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
    initialDisplayName = profileResult.data?.display_name?.trim().slice(0, 15) || "Storyteller"
  }

  return (
    <html lang="en" className={`${initialTheme} bg-background ${geistSans.variable} ${geistMono.variable} ${bookHand.variable} ${lora.variable}`}>
      <body className="font-sans antialiased">
        <AppProviders
          initialUserId={authenticated?.id ?? null}
          initialDisplayName={initialDisplayName}
          initialMembershipActive={initialMembershipActive}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  )
}

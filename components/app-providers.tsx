"use client"

import { useLayoutEffect } from "react"
import { usePathname } from "next/navigation"
import { AppProvider } from "@/lib/app-state"
import { MembershipSync } from "@/components/membership-sync"
import { GlobalInteractions } from "@/components/global-interactions"

export function AppProviders({
  children,
  initialUserId,
  initialDisplayName,
  initialMembershipActive,
}: {
  children: React.ReactNode
  initialUserId: string | null
  initialDisplayName: string
  initialMembershipActive: boolean
}) {
  const pathname = usePathname()

  useLayoutEffect(() => {
    // Never let a stale modal/body lock survive navigation. Native vertical
    // scrolling is the default for every StoryTuner route, including legal pages.
    document.documentElement.style.removeProperty("overflow")
    document.body.style.removeProperty("overflow")
  }, [pathname])

  return (
    <AppProvider
      initialUserId={initialUserId}
      initialDisplayName={initialDisplayName}
      initialMembershipActive={initialMembershipActive}
    >
      <MembershipSync />
      <GlobalInteractions />
      {children}
    </AppProvider>
  )
}

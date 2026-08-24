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
    // scrolling is the default for every Tellwise route, including legal pages.
    document.documentElement.style.removeProperty("overflow")
    document.body.style.removeProperty("overflow")

    // Public/auth/legal pages should never inherit a signed-in dark theme after
    // logout. We leave the preference cookie alone so it can return after login.
    if (!initialUserId) {
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
    }
  }, [initialUserId, pathname])

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

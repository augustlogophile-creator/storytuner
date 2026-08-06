"use client"

import { AppProvider } from "@/lib/app-state"
import { MembershipSync } from "@/components/membership-sync"

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
  return (
    <AppProvider
      initialUserId={initialUserId}
      initialDisplayName={initialDisplayName}
      initialMembershipActive={initialMembershipActive}
    >
      <MembershipSync />
      {children}
    </AppProvider>
  )
}

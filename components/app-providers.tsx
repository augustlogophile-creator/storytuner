"use client"

import { AppProvider } from "@/lib/app-state"
import { MembershipSync } from "@/components/membership-sync"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppProvider><MembershipSync />{children}</AppProvider>
}

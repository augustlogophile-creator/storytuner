"use client"

import { AppProvider } from "@/lib/app-state"
import { Onboarding } from "@/components/onboarding"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      {children}
      <Onboarding />
    </AppProvider>
  )
}

"use client"

import { AppProvider } from "@/lib/app-state"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>
}

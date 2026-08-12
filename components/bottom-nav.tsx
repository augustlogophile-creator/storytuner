"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, House, Mic2, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/home", label: "Today", icon: House },
  { href: "/activities", label: "Learn", icon: BookOpen },
  { href: "/arena", label: "Arena", icon: Mic2 },
  { href: "/community", label: "Community", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/88 backdrop-blur-2xl sm:bottom-5 sm:border-t-0 sm:bg-transparent sm:backdrop-blur-none"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 sm:rounded-[1.4rem] sm:border sm:border-border/80 sm:bg-card/95 sm:px-3 sm:py-2 sm:shadow-[0_18px_50px_rgb(48_45_42_/_0.12)]">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/home" ? pathname === "/home" : pathname.startsWith(href)
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press group flex flex-col items-center gap-1.5 rounded-2xl py-1 text-[0.62rem] font-semibold tracking-tight transition-colors duration-200",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300 ease-out",
                    active
                      ? "scale-100 bg-brand text-brand-foreground shadow-[0_6px_16px_-4px_color-mix(in_oklch,var(--brand)_55%,transparent)]"
                      : "scale-95 bg-transparent group-hover:bg-secondary",
                  )}
                >
                  <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={active ? 2.4 : 1.9} />
                </span>
                <span className="truncate">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

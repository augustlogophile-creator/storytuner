"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, House, Mic2, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/", label: "Today", icon: House },
  { href: "/activities", label: "Learn", icon: BookOpen },
  { href: "/arena", label: "Arena", icon: Mic2 },
  { href: "/community", label: "Community", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 rounded-xl py-1.5 text-[0.6rem] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <span className={cn("flex h-8 w-11 items-center justify-center rounded-full transition-colors", active ? "bg-brand-soft text-accent-foreground" : "bg-transparent")}>
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

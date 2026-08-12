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
      className="fixed inset-x-0 bottom-0 z-40 bg-transparent px-3 pb-[max(.6rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:px-0"
    >
      <ul className="mx-auto flex max-w-[29.5rem] items-stretch justify-between rounded-[2rem] border border-primary/90 bg-primary p-2 shadow-[0_18px_45px_rgb(29_27_20_/_0.2)]">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/home" ? pathname === "/home" : pathname.startsWith(href)
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press group flex flex-col items-center gap-1 rounded-[1.5rem] px-1 py-1.5 text-[0.62rem] font-bold tracking-tight transition-all duration-200",
                  active ? "bg-background text-foreground" : "text-primary-foreground/55 hover:text-primary-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-11 items-center justify-center rounded-full transition-all duration-300 ease-out",
                    active
                      ? "scale-100 bg-transparent text-foreground"
                      : "scale-95 bg-transparent group-hover:bg-white/10",
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

"use client"

import Link from "next/link"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen, House, Mic2, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/home", label: "Home", icon: House },
  { href: "/activities", label: "Learn", icon: BookOpen },
  { href: "/studio", label: "Studio", icon: Mic2 },
  { href: "/community", label: "Community", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    for (const item of items) router.prefetch(item.href)
  }, [router])

  return (
    <nav aria-label="Primary" className="book-bottom-nav fixed bottom-0 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 border-t border-border bg-background/97 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href)
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link prefetch href={href} aria-current={active ? "page" : undefined} className={cn("book-nav-item flex flex-col items-center gap-1 rounded-xl py-1.5 text-[0.6rem] font-medium transition-colors duration-100", active ? "text-foreground" : "text-muted-foreground hover:text-foreground") }>
                <span className={cn("book-nav-pill flex h-8 w-11 items-center justify-center rounded-full transition-colors duration-100", active ? "bg-[#625f5a] text-white shadow-[0_4px_14px_rgba(31,27,23,0.07)]" : "bg-transparent") }>
                  <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={active ? 2.4 : 1.9} />
                </span>
                <span className="book-nav-label truncate">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function isActivePath(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home"
  if (href === "/activities") return pathname.startsWith("/activities") || pathname.startsWith("/lesson")
  if (href === "/studio") return pathname.startsWith("/studio") || pathname.startsWith("/arena") || pathname.startsWith("/planner")
  if (href === "/profile") return ["/profile", "/progress", "/membership", "/shop", "/settings", "/legal"].some((path) => pathname.startsWith(path))
  return pathname.startsWith(href)
}

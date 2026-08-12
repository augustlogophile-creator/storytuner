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
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(.55rem,env(safe-area-inset-bottom))] sm:bottom-3 sm:px-0"
    >
      <ul className="mx-auto flex max-w-[27.5rem] items-center justify-between rounded-[1.45rem] border border-white/8 bg-[#22251f]/[0.97] p-1.5 shadow-[0_14px_38px_rgb(28_31_26_/_0.16)] backdrop-blur-xl">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/home" ? pathname === "/home" : pathname.startsWith(href)
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press group flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] px-1 py-1 text-[0.54rem] font-medium tracking-[-0.01em] transition-[background-color,color,transform] duration-200",
                  active
                    ? "nav-active bg-[#f7f6f1] text-[#242620]"
                    : "text-[#d6d6cf]/55 hover:bg-white/[0.045] hover:text-[#f7f6f1]",
                )}
              >
                <Icon
                  className={cn("h-[0.98rem] w-[0.98rem] transition-transform duration-200", active && "-translate-y-px")}
                  strokeWidth={active ? 2 : 1.7}
                />
                <span className="max-w-full truncate leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

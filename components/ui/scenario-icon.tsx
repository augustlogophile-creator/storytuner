import type { SVGProps } from "react"

export function ScenarioIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3.25a4.7 4.7 0 0 0-4.7 4.7c0 3.7 4.7 8.1 4.7 8.1s4.7-4.4 4.7-8.1a4.7 4.7 0 0 0-4.7-4.7Z" />
      <circle cx="12" cy="7.95" r="1.45" />
      <path d="m7.2 13.35-3.05 5.4a1.35 1.35 0 0 0 1.18 2h13.34a1.35 1.35 0 0 0 1.18-2l-3.05-5.4" />
    </svg>
  )
}

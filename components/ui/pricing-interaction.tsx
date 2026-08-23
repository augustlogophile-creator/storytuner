"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type MembershipPlanChoice = "annual" | "monthly"

const planCopy = {
  annual: {
    name: "Annual",
    price: "$60",
    cadence: "/ year",
    detail: "Equivalent to $5 a month",
    badge: "Best value",
  },
  monthly: {
    name: "Monthly",
    price: "$5.99",
    cadence: "/ month",
    detail: "Flexible month-to-month access",
    badge: null,
  },
} as const

export function PricingInteraction({
  value,
  onChange,
}: {
  value: MembershipPlanChoice
  onChange: (plan: MembershipPlanChoice) => void
}) {
  return (
    <div className="membership-pricing-grid" role="radiogroup" aria-label="Choose a Tellwise Membership plan">
      {(["monthly", "annual"] as const).map((plan) => {
        const selected = value === plan
        const copy = planCopy[plan]
        return (
          <button
            key={plan}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(plan)}
            className={cn("membership-plan-choice", selected && "is-selected")}
          >
            <span className="membership-plan-copy">
              <span className="membership-plan-name-row">
                <strong>{copy.name}</strong>
                {copy.badge && <span className="membership-plan-badge">{copy.badge}</span>}
              </span>
              <span className="membership-plan-price-row">
                <strong>{copy.price}</strong>
                <small>{copy.cadence}</small>
              </span>
              <span className="membership-plan-detail">{copy.detail}</span>
            </span>
            <span className="membership-plan-radio" aria-hidden="true">
              <span>{selected ? <Check /> : null}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

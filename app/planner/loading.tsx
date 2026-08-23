import { BottomNav } from "@/components/bottom-nav"

export default function PlannerLoading() {
  return (
    <div className="app-shell book-app mx-auto flex min-h-dvh w-full max-w-md min-w-0 flex-col bg-background">
      <main className="book-app-content w-full min-w-0 flex-1 overflow-x-hidden px-5 pb-28 pt-6">
        <div className="planner-route-loading" aria-label="Loading Story Planner" aria-busy="true">
          <div className="planner-route-loading-back skeleton-block" />
          <div className="planner-route-loading-hero skeleton-block" />
          <div className="planner-route-loading-row skeleton-block" />
          <div className="planner-route-loading-title skeleton-block" />
          <div className="planner-route-loading-card skeleton-block" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

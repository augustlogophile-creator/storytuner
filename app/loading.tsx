export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading StoryTuner"
      className="book-app mx-auto min-h-dvh w-full max-w-md bg-background px-5 pb-24 pt-6"
    >
      <div className="route-stability-shell" aria-hidden="true">
        <div className="route-stability-kicker skeleton-block" />
        <div className="route-stability-title skeleton-block" />
        <div className="route-stability-subtitle skeleton-block" />
        <div className="route-stability-card skeleton-block" />
        <div className="route-stability-card route-stability-card-short skeleton-block" />
      </div>
    </main>
  )
}

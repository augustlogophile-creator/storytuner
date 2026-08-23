export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading Tellwise" className="app-shell route-loading-shell book-app mx-auto min-h-dvh w-full bg-background px-5 pb-24 pt-6">
      <div className="route-stability-shell route-stability-quiet" aria-hidden="true">
        <div className="route-stability-title skeleton-block" />
        <div className="route-stability-card route-stability-card-short skeleton-block" />
      </div>
    </main>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background px-5 pb-28 pt-6" aria-label="Loading StoryTuner">
      <div className="skeleton-block h-5 w-28 rounded-full" />
      <div className="mt-4 space-y-2">
        <div className="skeleton-block h-8 w-4/5 rounded-xl" />
        <div className="skeleton-block h-4 w-3/5 rounded-lg" />
      </div>
      <div className="skeleton-block mt-7 h-44 rounded-[1.75rem]" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="skeleton-block h-36 rounded-[1.6rem]" />
        <div className="skeleton-block h-36 rounded-[1.6rem]" />
      </div>
    </div>
  )
}

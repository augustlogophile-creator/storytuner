"use client"

export const ParchReading = () => {
  return (
    <div
      className="auth-parch mx-auto overflow-hidden rounded-2xl"
      style={{ background: "#F8F8F4", maxWidth: 106 }}
    >
      <video
        src="/parch-reading.mp4"
        autoPlay
        muted
        loop
        playsInline
        style={{ aspectRatio: "752 / 560" }}
        className="w-full object-contain"
      />
    </div>
  )
}

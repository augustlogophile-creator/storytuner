"use client"

export const ParchReading = () => {
  return (
    <div className="auth-parch mx-auto" style={{ maxWidth: 132 }}>
      <video
        src="/parch-reading.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Parch reading a book"
        style={{
          aspectRatio: "752 / 560",
          WebkitMaskImage:
            "radial-gradient(ellipse 72% 76% at 50% 50%, #000 0%, #000 66%, rgba(0,0,0,.92) 76%, rgba(0,0,0,.55) 87%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 72% 76% at 50% 50%, #000 0%, #000 66%, rgba(0,0,0,.92) 76%, rgba(0,0,0,.55) 87%, transparent 100%)",
        }}
        className="auth-parch-video block w-full object-contain"
      />
    </div>
  )
}

"use client";

export const ParchReading = () => {
  return (
    <video
      src="/parch-reading.mp4"
      autoPlay
      muted
      loop
      playsInline
      style={{ aspectRatio: "752 / 560" }}
      className="w-full max-w-[280px] mx-auto object-contain"
    />
  );
};

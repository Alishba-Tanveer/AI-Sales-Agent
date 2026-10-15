// CSS-only mesh gradient background (no blobs, no grid, no JS).
// Colours come from the Stitch palette: #0B0F19, #2F3AA3, #818CF8, #60A5FA, #C084FC, #C7D2FE.
export function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundColor: "#0B0F19",
        backgroundImage: [
          "radial-gradient(70% 60% at 8% 0%, rgba(47,58,163,0.85) 0%, transparent 72%)",
          "radial-gradient(60% 55% at 0% 100%, rgba(96,165,250,0.80) 0%, transparent 70%)",
          "radial-gradient(55% 55% at 100% 100%, rgba(192,132,252,0.70) 0%, transparent 70%)",
          "radial-gradient(40% 35% at 62% 92%, rgba(199,210,254,0.45) 0%, transparent 70%)",
          "radial-gradient(45% 40% at 50% 70%, rgba(129,140,248,0.35) 0%, transparent 70%)",
          "linear-gradient(180deg, #0B0F19 0%, #141A3C 60%, #1B2036 100%)",
        ].join(", "),
      }}
    />
  );
}

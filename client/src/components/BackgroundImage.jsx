import hospitalBg from "../assets/hospital-bg.jpg";

// Fixed, blurred hospital photo behind the entire app. Sits at z-index -10 so
// every real UI surface (Cards, sidebar, forms) — all opaque — layers on top
// of it. Only the gaps between those surfaces let the image show through.
export default function BackgroundImage() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
        style={{ backgroundImage: `url(${hospitalBg})` }}
      />
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/85" />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-fuchsia-500/5 to-accent-500/10" />
    </div>
  );
}

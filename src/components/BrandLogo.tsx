// Hotel van Saaze wordmark/logo for the header chrome. Server component: it
// checks on disk whether the real asset is present and only then renders an
// <img> — so a missing file degrades to a text wordmark, never a broken image.
//
// asset volgt — Tim plaatst public/brand/logo-saaze.svg (volledig logo).
// fs-check path: <project root>/public/brand/logo-saaze.svg  (process.cwd() is the project root at runtime).
import { existsSync } from "node:fs";
import { join } from "node:path";

const PUBLIC_SRC = "/brand/logo-saaze.svg";
const DISK_PATH = join(process.cwd(), "public", "brand", "logo-saaze.svg");

export function BrandLogo({ className = "" }: { className?: string }) {
  if (existsSync(DISK_PATH)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={PUBLIC_SRC} alt="Hotel van Saaze" className={className} />;
  }
  // Fallback: text wordmark in copper — no 404, no broken <img>.
  return (
    <span className={`whitespace-nowrap font-semibold tracking-wide text-brand-copper ${className}`}>
      Hotel van Saaze
    </span>
  );
}

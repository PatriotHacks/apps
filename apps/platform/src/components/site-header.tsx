import { ThemeToggle } from "@patriothacks/ui";
import Image from "next/image";
import Link from "next/link";

/**
 * Top of every applicant-facing page. Links home from the logo, which is where
 * someone expects to land when a form turns out not to be the one they wanted.
 */
export function SiteHeader() {
  return (
    <div className="flex h-14 items-center justify-between gap-4 px-4">
      <Link href="/" className="flex items-center gap-2">
        {/* Sized by height with width auto so the intrinsic ratio holds. */}
        <Image src="/logo.png" alt="" width={1803} height={1274} priority className="h-8 w-auto" />
        <span className="text-sm font-semibold tracking-tight">PatriotHacks</span>
      </Link>
      <ThemeToggle />
    </div>
  );
}

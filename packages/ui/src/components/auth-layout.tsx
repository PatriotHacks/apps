import * as React from "react";

/**
 * The art panel. Inline SVG rather than an image so it re-themes with the
 * tokens and stays crisp at any size — every fill is a `--auth-art-*` variable.
 *
 * Four overlapping planes: a soft grey gradient field, a broad slate band, a
 * near-black navy field meeting that gradient along a diagonal seam, and a
 * translucent counter-diagonal plane crossing both.
 */
function AuthArt() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="auth-art-mist" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--auth-art-mist)" />
          <stop offset="100%" stopColor="var(--auth-art-mist-edge)" />
        </linearGradient>
        <linearGradient id="auth-art-veil" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="var(--auth-art-slate)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--auth-art-slate)" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      <rect width="600" height="800" fill="url(#auth-art-mist)" />
      <path d="M0 230 L600 -50 L600 110 L0 390 Z" fill="var(--auth-art-slate)" opacity="0.9" />
      <path d="M0 470 L600 190 L600 800 L0 800 Z" fill="var(--auth-art-ink)" />
      <path d="M0 620 L600 340 L600 415 L0 695 Z" fill="var(--auth-art-slate)" opacity="0.55" />
      <path d="M200 -20 L430 -20 L620 820 L390 820 Z" fill="url(#auth-art-veil)" />
    </svg>
  );
}

interface AuthLayoutProps {
  /** Brand name. Set in the serif, lowercased visually but not in the DOM. */
  wordmark: string;
  heading: string;
  children: React.ReactNode;
}

/**
 * Two-panel sign-in screen. Below 900px the art is dropped entirely and the
 * form column centres full-width, so the form never shrinks to share the row.
 */
function AuthLayout({ wordmark, heading, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="font-serif text-4xl lowercase italic min-[900px]:text-[2.75rem]">
            {wordmark}
          </p>
          <h1 className="mt-10 font-serif text-xl text-muted-foreground">{heading}</h1>
          <div className="mt-10 flex flex-col gap-4">{children}</div>
        </div>
      </div>

      <div className="hidden flex-1 p-6 min-[900px]:flex">
        <div className="relative flex-1 overflow-hidden rounded-[28px] border border-border">
          <AuthArt />
        </div>
      </div>
    </div>
  );
}

export { AuthLayout, type AuthLayoutProps };

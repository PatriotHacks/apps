"use client";

import * as React from "react";
import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "#components/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917Z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917Z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}

const OAUTH = {
  google: { label: "Continue with Google", Icon: GoogleIcon },
  github: { label: "Continue with GitHub", Icon: GithubIcon },
} as const;

type OAuthProvider = keyof typeof OAUTH;

type AuthEmphasis = "solid" | "outline";

/**
 * The pill. `solid` inverts against the page rather than using the accent, so
 * it reads black on light and white on dark.
 */
function AuthActionButton({
  className,
  emphasis = "solid",
  ...props
}: React.ComponentProps<"button"> & { emphasis?: AuthEmphasis }) {
  return (
    <Button
      variant={emphasis === "solid" ? "default" : "outline"}
      className={cn(
        "h-auto w-full gap-3 rounded-full px-6 py-4 text-sm font-medium",
        emphasis === "solid" && "bg-foreground text-background hover:bg-foreground/90",
        className,
      )}
      {...props}
    />
  );
}

function AuthProviderButton({
  provider,
  emphasis = "solid",
  ...props
}: React.ComponentProps<"button"> & { provider: OAuthProvider; emphasis?: AuthEmphasis }) {
  const { label, Icon } = OAUTH[provider];

  return (
    <AuthActionButton type="button" emphasis={emphasis} {...props}>
      <Icon />
      {label}
    </AuthActionButton>
  );
}

/** Quiet toggle for the secondary sign-in form. */
function AuthDisclosure({
  open,
  onOpenChange,
  label,
  controls,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  controls: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={() => {
        onOpenChange(!open);
      }}
      className={cn(
        "inline-flex items-center gap-1 self-center rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      {label}
      <ChevronDownIcon
        className={cn("size-4 transition-transform", open && "rotate-180")}
        aria-hidden="true"
      />
    </button>
  );
}

/** Sign-in failures and the magic-link confirmation. */
function AuthNotice({
  tone = "error",
  className,
  children,
}: {
  tone?: "error" | "success";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/40 bg-primary/10 text-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export {
  AuthActionButton,
  AuthDisclosure,
  AuthNotice,
  AuthProviderButton,
  type OAuthProvider,
};

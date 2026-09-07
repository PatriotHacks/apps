import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, not a build.
  transpilePackages: [
    "@patriothacks/database",
    "@patriothacks/emails",
    "@patriothacks/form-engine",
    "@patriothacks/ui",
  ],
  // `pg` resolves its driver at runtime; bundling it breaks that.
  serverExternalPackages: ["pg"],
  // Enables forbidden(), which is how an admin-only page refuses an organizer with a real 403.
  experimental: { authInterrupts: true },
};

export default nextConfig;

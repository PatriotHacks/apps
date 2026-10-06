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
};

export default nextConfig;

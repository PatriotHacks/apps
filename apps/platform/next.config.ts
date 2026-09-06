import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

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

// Dev only. The adapter's own guard just dedupes `next dev`'s two processes; it does
// not stop miniflare booting during `next build`, where it collides with .wrangler
// state locks and fails with SQLITE_BUSY.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}

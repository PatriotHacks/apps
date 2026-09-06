import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Dev only. The adapter's own guard just dedupes `next dev`'s two processes; it does
// not stop miniflare booting during `next build`, where it collides with .wrangler
// state locks and fails with SQLITE_BUSY.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}

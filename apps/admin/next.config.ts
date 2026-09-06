import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

// Makes Cloudflare bindings available via getCloudflareContext() during
// `next dev`, so local development matches the Workers runtime.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

void initOpenNextCloudflareForDev();

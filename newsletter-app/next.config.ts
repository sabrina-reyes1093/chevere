import fs from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    SITE_CONTENT_FALLBACK_JSON: fs.readFileSync(path.resolve(process.cwd(), "site-content-fallback.json"), "utf8"),
  },
};

export default nextConfig;

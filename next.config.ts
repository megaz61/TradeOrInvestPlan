import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Prisma requires this for edge compatibility
  serverExternalPackages: ["@prisma/client", "prisma"],
}

export default nextConfig

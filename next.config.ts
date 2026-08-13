import type { NextConfig } from "next";

/**
 * Las imágenes se sirven desde Supabase Storage. El host depende del proyecto,
 * así que se deriva de `NEXT_PUBLIC_SUPABASE_URL` en tiempo de compilación.
 */
const hostSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  experimental: {
    // Las fotos de productos y portadas se suben por Server Actions.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    remotePatterns: hostSupabase
      ? [
          {
            protocol: "https",
            hostname: hostSupabase,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;

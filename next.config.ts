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
  /**
   * `src/lib/imagenes.ts` compone el isologo municipal sobre las fotos del
   * catálogo, leyéndolo del disco. Los archivos de `public/` se sirven como
   * estáticos pero no están garantizados en el sistema de archivos de una
   * función serverless, así que hay que declararlo para que viaje con el bundle.
   * Sin esto anda en desarrollo y falla en el deploy.
   */
  outputFileTracingIncludes: {
    "/**": ["./public/logo.png"],
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

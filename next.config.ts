import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "placeholder.supabase.co";

const config: NextConfig = {
  // Lets you open the dev server from a phone on the same Wi-Fi (e.g. http://192.168.x.x:3000). Without this, Next.js blocks its own scripts from
  // other addresses, so the page loads but nothing is interactive (the menu button does nothing). Development only; has no effect in production.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "172.17.*.*", "172.18.*.*", "172.19.*.*", "172.2*.*.*", "172.30.*.*", "172.31.*.*", "*.local"],
  // Hides the round "N" development badge (bottom-left). Production builds never show it.
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost },
      // Existing WordPress.com media, used until images are migrated to Supabase Storage.
      { protocol: "https", hostname: "bewithyoga.live" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "bewithyoga.files.wordpress.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // Preserve legacy WordPress URLs (301).
  async redirects() {
    return [
      { source: "/blog", destination: "/journal", permanent: true },
      { source: "/blog/:path*", destination: "/journal", permanent: true },
      { source: "/bewithyoga.live/about", destination: "/about", permanent: true },
      { source: "/bewithyoga.live/schedule", destination: "/schedule", permanent: true },
      { source: "/bewithyoga.live/gallery", destination: "/gallery", permanent: true },
      { source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:slug", destination: "/journal/:slug", permanent: true },
    ];
  },
};

export default config;

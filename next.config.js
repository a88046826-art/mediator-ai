/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove 'export' to support API routes (server-side).
  // For GitHub Pages deploy, run `next build && next export` separately.
  // For Vercel, this config works as-is.
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;

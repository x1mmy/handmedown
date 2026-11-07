/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "playwright"],
  images: { unoptimized: true },
};

export default nextConfig;

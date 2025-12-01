/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep pages-based routing for simplicity and Azure Static Web Apps compatibility
  // During development, ignore changes under `data/` and `.next/` to avoid
  // triggering Fast Refresh on backend persistence writes.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = config.watchOptions || {};
      config.watchOptions.ignored = ["**/data/**", "**/.next/**", "**/.git/**"];
    }
    return config;
  },
};

module.exports = nextConfig;

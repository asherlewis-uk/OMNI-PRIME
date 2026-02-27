/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  swcMinify: true,
  distDir: ".next", // Changed from 'dist' back to Next.js standard
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/onboarding",
        has: [
          {
            type: "cookie",
            key: "omni-has-genesis",
            value: "(?!true)",
          },
        ],
        permanent: false,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Handle native modules on client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        stream: false,
        buffer: false,
        util: false,
        assert: false,
        constants: false,
        child_process: false,
        dns: false,
        dgram: false,
        cluster: false,
        module: false,
        readline: false,
        repl: false,
        vm: false,
        async_hooks: false,
        inspector: false,
        perf_hooks: false,
        trace_events: false,
        worker_threads: false,
        v8: false,
        wasi: false,
        node: false,
      };
    }

    // Support for top-level await
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
      layers: true,
    };

    return config;
  },
  experimental: {
    scrollRestoration: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    // Avoid self-rewriting if apiUrl matches local Next.js port
    if (apiUrl.startsWith("http") && !apiUrl.includes(":3000")) {
      const cleanApiUrl = apiUrl.replace(/\/+$/, "");
      return [
        {
          source: "/api/v1/:path*",
          destination: `${cleanApiUrl}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;

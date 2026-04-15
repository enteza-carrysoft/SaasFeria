import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
    serverActions: {
      // Fotos de cámara móvil pesan 3-8MB; el límite por defecto es 1MB
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: ['@supabase/ssr'],
}

export default nextConfig

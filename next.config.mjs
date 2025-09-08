/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.BASEPATH || '',
  eslint: {
    ignoreDuringBuilds: true // não falha o build por erros de ESLint
  }
}

export default nextConfig

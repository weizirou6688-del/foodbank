import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const parseSimpleEnvFile = (filePath: string): Record<string, string> => {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .reduce<Record<string, string>>((env, line) => {
      const separatorIndex = line.indexOf('=')
      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      env[key] = value
      return env
    }, {})
}

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const projectRoot = path.resolve(__dirname, '..')
const sharedDevEnv = parseSimpleEnvFile(path.resolve(projectRoot, 'dev.env'))
const getConfigValue = (key: string, fallback: string): string =>
  process.env[key] ?? sharedDevEnv[key] ?? fallback

const devHost = getConfigValue('DEV_HOST', '127.0.0.1')
const backendPort = toNumber(getConfigValue('BACKEND_PORT', '8000'), 8000)
const frontendPort = toNumber(
  getConfigValue('VITE_FRONTEND_PORT', getConfigValue('FRONTEND_PORT', '5173')),
  5173,
)
const previewPort = toNumber(getConfigValue('FRONTEND_PREVIEW_PORT', '4173'), 4173)
const strictPort = toBoolean(process.env.VITE_STRICT_PORT, false)
const apiProxyTarget = getConfigValue(
  'VITE_API_PROXY_TARGET',
  `http://${devHost}:${backendPort}`,
)

const getNodeModulePackageName = (id: string): string | null => {
  const normalizedId = id.replace(/\\/g, '/')
  const segments = normalizedId.split('/node_modules/')
  if (segments.length < 2) {
    return null
  }

  const packagePath = segments[segments.length - 1]
  const parts = packagePath.split('/')
  if (!parts[0]) {
    return null
  }

  if (parts[0].startsWith('@') && parts[1]) {
    return `${parts[0]}/${parts[1]}`
  }

  return parts[0]
}

const sanitizeChunkName = (name: string): string => name.replace(/^@/, '').replace(/[\\/]/g, '-')

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          const packageName = getNodeModulePackageName(id)
          if (!packageName) {
            return 'vendor'
          }

          if (
            packageName === 'react' ||
            packageName === 'react-dom' ||
            packageName === 'scheduler'
          ) {
            return 'react-vendor'
          }

          if (
            packageName === 'react-router' ||
            packageName === 'react-router-dom' ||
            packageName === '@remix-run/router'
          ) {
            return 'router'
          }

          if (
            packageName === 'leaflet' ||
            packageName === 'react-leaflet' ||
            packageName === '@react-leaflet/core'
          ) {
            return 'maps'
          }

          if (packageName === 'lucide-react') {
            return 'icons'
          }

          if (packageName === 'zustand' || packageName === 'use-sync-external-store') {
            return 'state'
          }

          return `vendor-${sanitizeChunkName(packageName)}`
        },
      },
    },
  },
  server: {
    host: devHost,
    port: frontendPort,
    strictPort,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: devHost,
    port: previewPort,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

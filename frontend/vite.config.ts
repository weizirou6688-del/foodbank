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

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react-router-dom')) {
            return 'router'
          }

          if (id.includes('react-leaflet') || id.includes('leaflet')) {
            return 'maps'
          }

          if (id.includes('lucide-react')) {
            return 'icons'
          }

          if (id.includes('react-dom') || id.includes(`${path.sep}react${path.sep}`)) {
            return 'react-vendor'
          }

          return 'vendor'
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

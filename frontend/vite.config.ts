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

const foodManagementTemplatePath = path.resolve(projectRoot, 'scripts', 'food_management.html')
const FOOD_MANAGEMENT_VIRTUAL_MODULE = 'virtual:food-management-template'
const FOOD_MANAGEMENT_VIRTUAL_MODULE_ID = `\0${FOOD_MANAGEMENT_VIRTUAL_MODULE}`

const listFilesRecursively = (dirPath: string): string[] => {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name)
    return entry.isDirectory() ? listFilesRecursively(fullPath) : [fullPath]
  })
}

const readFoodManagementBackup = (): string => {
  const appDataPath = process.env.APPDATA
  if (!appDataPath) {
    return ''
  }

  const backupsRoot = path.join(appDataPath, 'Code', 'Backups')
  const backupFiles = listFilesRecursively(backupsRoot)

  for (const backupFile of backupFiles) {
    try {
      const content = fs.readFileSync(backupFile, 'utf8')
      if (!content.includes('scripts/food_management.html')) {
        continue
      }

      return content.replace(/^.*\r?\n/, '')
    } catch {
      continue
    }
  }

  return ''
}

const loadFoodManagementTemplate = (): string => {
  if (fs.existsSync(foodManagementTemplatePath) && fs.statSync(foodManagementTemplatePath).size > 0) {
    return fs.readFileSync(foodManagementTemplatePath, 'utf8')
  }

  return readFoodManagementBackup()
}

const xlsxChunkPackages = new Set([
  'xlsx',
  'cfb',
  'codepage',
  'ssf',
  'frac',
  'crc-32',
  'adler-32',
  'wmf',
  'word',
])

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

const htmlTemplatePlugin = () => ({
  name: 'html-template-plugin',
  resolveId(id: string) {
    if (id === FOOD_MANAGEMENT_VIRTUAL_MODULE) {
      return FOOD_MANAGEMENT_VIRTUAL_MODULE_ID
    }

    return null
  },
  load(id: string) {
    if (id === FOOD_MANAGEMENT_VIRTUAL_MODULE_ID) {
      return `export default ${JSON.stringify(loadFoodManagementTemplate())};`
    }

    return null
  },
})
export default defineConfig({
  plugins: [react(), htmlTemplatePlugin()],
  build: {
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

          if (xlsxChunkPackages.has(packageName)) {
            return 'xlsx'
          }

          if (packageName === 'zustand' || packageName === 'use-sync-external-store') {
            return 'state'
          }

          if (
            packageName === 'class-variance-authority' ||
            packageName === 'clsx' ||
            packageName === 'tailwind-merge'
          ) {
            return 'ui-utils'
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

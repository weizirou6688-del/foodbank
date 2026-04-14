export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false
  if (!/[A-Za-z]/.test(password)) return false
  if (!/\d/.test(password)) return false
  if (!/[^A-Za-z0-9]/.test(password)) return false
  if (/\s/.test(password)) return false
  return true
}

export function isValidCardNumber(card: string): boolean {
  return card.replace(/\s/g, '').length === 16
}

export function isValidExpiry(expiry: string): boolean {
  return /^\d{2}\/\d{2}$/.test(expiry)
}

export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

export function formatExpiryDate(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 4)
  if (digits.length >= 2) {
    return `${digits.substring(0, 2)}/${digits.substring(2)}`
  }
  return digits
}

export function normalizePostcodeInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 8)
}

export function sanitizeDateTextInput(value: string): string {
  return value.replace(/[^\d/-]/g, '').slice(0, 10)
}
/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate strong password: English letters + numbers + special characters, no spaces
 */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false
  if (!/[A-Za-z]/.test(password)) return false
  if (!/\d/.test(password)) return false
  if (!/[^A-Za-z0-9]/.test(password)) return false
  if (/\s/.test(password)) return false
  return true
}

/**
 * Validate card number (16 digits, spaces allowed)
 */
export function isValidCardNumber(card: string): boolean {
  return card.replace(/\s/g, '').length === 16
}

/**
 * Validate expiry date format MM/YY
 */
export function isValidExpiry(expiry: string): boolean {
  return /^\d{2}\/\d{2}$/.test(expiry)
}

/**
 * Format card number input with spaces every 4 digits
 */
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Format expiry date input as MM/YY
 */
export function formatExpiryDate(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 4)
  if (digits.length >= 2) {
    return digits.substring(0, 2) + '/' + digits.substring(2)
  }
  return digits
}

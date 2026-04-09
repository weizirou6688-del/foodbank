function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function buildFoodBankDisplayAddress(address: string, postcode: string) {
  const normalizedAddress = normalizeWhitespace(address)
  const normalizedPostcode = normalizeWhitespace(postcode).toUpperCase()

  if (!normalizedAddress) {
    return normalizedPostcode
  }

  if (!normalizedPostcode) {
    return normalizedAddress
  }

  // Some feed records already include the postcode inside the address field.
  // Strip any inline copy before appending the canonical postcode once.
  const postcodePattern = new RegExp(
    escapeRegExp(normalizedPostcode).replace(/\s+/g, '\\s*'),
    'gi',
  )

  const addressWithoutPostcode = normalizedAddress
    .replace(postcodePattern, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')

  return addressWithoutPostcode ? `${addressWithoutPostcode}, ${normalizedPostcode}` : normalizedPostcode
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}
function normalizeSearchText(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}
export function findInternalFoodBankMatch<T extends { name: string; address: string }>(
  candidate: { name: string; address: string },
  internalBanks: readonly T[],
): T | null {
  const normalizedName = normalizeSearchText(candidate.name)
  const normalizedAddress = normalizeSearchText(candidate.address)
  return internalBanks.find((bank) => {
    const bankName = normalizeSearchText(bank.name)
    const bankAddress = normalizeSearchText(bank.address)
    return bankName === normalizedName
      || bankAddress === normalizedAddress
      || bankName.includes(normalizedName)
      || normalizedName.includes(bankName)
      || bankAddress.includes(normalizedAddress)
      || normalizedAddress.includes(bankAddress)
  }) ?? null
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

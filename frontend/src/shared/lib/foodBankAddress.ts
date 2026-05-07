function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
function normalizeSearchText(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}
export function findInternalFoodBankMatch<
  T extends { name: string; address: string },
>(
  candidate: { name: string; address: string },
  internalBanks: readonly T[],
): T | null {
  const normalizedName = normalizeSearchText(candidate.name);
  const normalizedAddress = normalizeSearchText(candidate.address);
  return (
    // 公开查询数据与内部记录很少共享稳定标识符,故意保持宽松的文本匹配
    internalBanks.find((bank) => {
      const bankName = normalizeSearchText(bank.name);
      const bankAddress = normalizeSearchText(bank.address);
      return (
        bankName === normalizedName ||
        bankAddress === normalizedAddress ||
        bankName.includes(normalizedName) ||
        normalizedName.includes(bankName) ||
        bankAddress.includes(normalizedAddress) ||
        normalizedAddress.includes(bankAddress)
      );
    }) ?? null
  );
}
export function buildFoodBankDisplayAddress(address: string, postcode: string) {
  const normalizedAddress = normalizeWhitespace(address);
  const normalizedPostcode = normalizeWhitespace(postcode).toUpperCase();
  if (!normalizedAddress) {
    return normalizedPostcode;
  }
  if (!normalizedPostcode) {
    return normalizedAddress;
  }
  const postcodePattern = new RegExp(
    escapeRegExp(normalizedPostcode).replace(/\s+/g, "\\s*"),
    "gi",
  );
  // 外部 API 返回的地址字符串常已内嵌邮编,先剥离再统一追加大写规范邮编
  const addressWithoutPostcode = normalizedAddress
    .replace(postcodePattern, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^,\s*/, "")
    .replace(/,\s*$/, "");
  return addressWithoutPostcode
    ? `${addressWithoutPostcode}, ${normalizedPostcode}`
    : normalizedPostcode;
}

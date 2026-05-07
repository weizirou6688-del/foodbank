export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  if (/\s/.test(password)) return false;
  return true;
}
export function isValidCardNumber(card: string): boolean {
  return card.replace(/\s/g, "").length === 16;
}
export function isValidExpiry(expiry: string): boolean {
  return /^\d{2}\/\d{2}$/.test(expiry);
}
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").substring(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
export function formatExpiryDate(value: string): string {
  const digits = value.replace(/\D/g, "").substring(0, 4);
  if (digits.length >= 2) {
    return `${digits.substring(0, 2)}/${digits.substring(2)}`;
  }
  return digits;
}
export function normalizePostcodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 8);
}
export function sanitizeDateTextInput(value: string): string {
  return value.replace(/[^\d/-]/g, "").slice(0, 10);
}

type CashDonationValidationDetails = {
  email: string;
  donorName: string;
  cardNumber: string;
  expiryDate: string;
  securityCode: string;
};

type GoodsDonationValidationDetails = {
  name: string;
  email: string;
  phone: string;
  pickupDate: string;
  items: string;
  condition: string;
};

export type ParsedPickupDate = {
  date: Date;
  isoDate: string;
  ukDate: string;
};

function formatUkDate(date: Date) {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().padStart(4, "0");
  return `${day}/${month}/${year}`;
}

function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function getCashDonationValidationMessage(
  amount: number,
  formData: CashDonationValidationDetails,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Please select or enter a valid donation amount.";
  }

  if (!formData.donorName.trim()) {
    return "Please enter the cardholder name.";
  }

  if (!isValidEmail(formData.email.trim())) {
    return "Please enter a valid email address.";
  }

  if (!isValidCardNumber(formData.cardNumber)) {
    return "Please enter a valid 16-digit card number.";
  }

  if (!isValidExpiry(formData.expiryDate)) {
    return "Please enter a valid expiry date in MM/YY format.";
  }

  const [monthString, yearString] = formData.expiryDate.split("/");
  const month = Number.parseInt(monthString, 10);
  const year = Number.parseInt(yearString, 10);
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;

  if (
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    year < currentYear ||
    (year === currentYear && month < currentMonth)
  ) {
    return "Please enter a valid future expiry date in MM/YY format.";
  }

  if (!/^\d{3,4}$/.test(formData.securityCode)) {
    return "Please enter a valid CVV.";
  }

  return null;
}

// 兼容捐赠者最常见的几种日期输入格式,统一转成英国友好的显示格式
export function parsePickupDate(value: string): ParsedPickupDate | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  let day = 0;
  let month = 0;
  let year = 0;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmedValue)) {
    const parts = trimmedValue.split("-").map(Number);
    year = parts[0] ?? 0;
    month = parts[1] ?? 0;
    day = parts[2] ?? 0;
  } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(trimmedValue)) {
    const normalizedValue = trimmedValue.replace(/-/g, "/");
    const parts = normalizedValue.split("/").map(Number);
    day = parts[0] ?? 0;
    month = parts[1] ?? 0;
    year = parts[2] ?? 0;
  } else if (/^\d{8}$/.test(trimmedValue)) {
    day = Number(trimmedValue.slice(0, 2));
    month = Number(trimmedValue.slice(2, 4));
    year = Number(trimmedValue.slice(4));
  } else {
    return null;
  }

  const parsedDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return {
    date: parsedDate,
    isoDate: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    ukDate: formatUkDate(parsedDate),
  };
}

export function getPickupDateError(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Preferred collection or drop-off date is required.";
  }

  const parsedPickupDate = parsePickupDate(trimmedValue);

  if (!parsedPickupDate) {
    return "Please enter a valid date in DD/MM/YYYY format.";
  }

  if (parsedPickupDate.date < getStartOfToday()) {
    return "Please enter a valid date on or after today.";
  }

  return "";
}

export function getPhoneError(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Phone number is required.";
  }

  if (trimmedValue.length < 3) {
    return "Phone number must be at least 3 characters.";
  }

  return "";
}

export function estimateQuantity(value: string) {
  const numbers = value.match(/\d+/g);

  if (!numbers) {
    return 1;
  }

  const total = numbers.reduce((sum, current) => sum + Number(current), 0);
  return total > 0 ? total : 1;
}

export function validateGoodsDonationDetails(
  details: GoodsDonationValidationDetails,
) {
  const nextErrors: Record<string, string> = {};

  if (!details.name.trim()) {
    nextErrors.name = "Full name is required.";
  }

  if (!isValidEmail(details.email.trim())) {
    nextErrors.email = "Please enter a valid email address.";
  }

  const phoneError = getPhoneError(details.phone);
  if (phoneError) {
    nextErrors.phone = phoneError;
  }

  const pickupDateError = getPickupDateError(details.pickupDate);
  if (pickupDateError) {
    nextErrors.pickupDate = pickupDateError;
  }

  if (!details.items.trim()) {
    nextErrors.items = "Please describe the items you are donating.";
  }

  if (!details.condition) {
    nextErrors.condition = "Please select the item condition.";
  }

  return nextErrors;
}

import { describe, expect, test } from "vitest";

import {
  estimateQuantity,
  getCashDonationValidationMessage,
  getPhoneError,
  isValidEmail,
  parsePickupDate,
  validateGoodsDonationDetails,
} from "./validation";

describe("validation", () => {
  test.each([
    ["test@aber.ac.uk", true],
    ["volunteer@northsidefoodbank.org", true],
    ["testtest.com", false],
    ["alex donor@example.com", false],
  ])("isValidEmail(%s) -> %s", (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });

  test.each([
    ["23/04/2026", { isoDate: "2026-04-23", ukDate: "23/04/2026" }],
    ["2026-04-23", { isoDate: "2026-04-23", ukDate: "23/04/2026" }],
    ["23042026", { isoDate: "2026-04-23", ukDate: "23/04/2026" }],
    ["31/02/2026", null],
  ])("parsePickupDate(%s)", (input, expected) => {
    const result = parsePickupDate(input);

    if (expected === null) {
      expect(result).toBeNull();
      return;
    }

    expect(result).not.toBeNull();
    expect(result).toMatchObject(expected);
  });

  test("all fields blank -> all error keys populated", () => {
    const errors = validateGoodsDonationDetails({
      name: " ",
      email: "bad-email",
      phone: "07",
      pickupDate: "",
      items: " ",
      condition: "",
    });

    expect(errors).toEqual({
      name: "Full name is required.",
      email: "Please enter a valid email address.",
      phone: "Phone number must be at least 3 characters.",
      pickupDate: "Preferred collection or drop-off date is required.",
      items: "Please describe the items you are donating.",
      condition: "Please select the item condition.",
    });
  });

  test("completed donate goods form details -> no validation errors", () => {
    const errors = validateGoodsDonationDetails({
      name: "Sarah Jones",
      email: "sarah.jones@example.com",
      phone: "07911 123456",
      pickupDate: "27/04/2099",
      items: "2 bags of rice and 1 box of cereal",
      condition: "new",
    });

    expect(errors).toEqual({});
  });

  test("cash donation validation accepts a complete monthly donate cash form", () => {
    expect(
      getCashDonationValidationMessage(20, {
        donorName: "Alex Donor",
        email: "alex@example.com",
        cardNumber: "4242 4242 4242 4242",
        expiryDate: "12/99",
        securityCode: "123",
      }),
    ).toBeNull();
  });

  test.each([
    ["2 bags and 3 boxes", 5],
    ["2 bags of rice and 1 box of cereal", 3],
    ["a mixed donation", 1],
  ])("estimateQuantity(%s) -> %i", (input, expected) => {
    expect(estimateQuantity(input)).toBe(expected);
  });

  test.each([
    ["12", "Phone number must be at least 3 characters."],
    ["07123 456789", ""],
  ])("getPhoneError(%s)", (input, expected) => {
    expect(getPhoneError(input)).toBe(expected);
  });
});

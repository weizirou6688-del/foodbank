import { useState, type FormEvent } from "react";
import { donationsAPI } from "@/shared/lib/api/donations";
import { foodBanksAPI } from "@/shared/lib/api/foodBanks";
import { normalizeWhitespace } from "@/shared/lib/foodBankAddress";
import {
  BACKEND_API_UNAVAILABLE_MESSAGE,
  LOCAL_FOOD_BANK_SEARCH_RADIUS_KM,
  buildRankedFoodBankOptions,
  getCoordinatesFromPostcode,
  getFoodBankLookupErrorMessage,
  getNearbyFoodbanks,
  type FoodBankOption,
} from "@/shared/lib/foodBankLookup";
import {
  estimateQuantity,
  getPhoneError,
  getPickupDateError,
  parsePickupDate,
  validateGoodsDonationDetails,
} from "@/shared/lib/validation";

export type DonationDetails = {
  name: string;
  email: string;
  phone: string;
  pickupDate: string;
  items: string;
  condition: string;
  quantity: string;
  notes: string;
};

export type FeedbackState = { type: "success" | "error"; message: string };
export type FieldErrors = Partial<Record<keyof DonationDetails, string>>;

const INITIAL_DETAILS: DonationDetails = {
  name: "",
  email: "",
  phone: "",
  pickupDate: "",
  items: "",
  condition: "",
  quantity: "",
  notes: "",
};

const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const INVALID_POSTCODE_MESSAGE =
  "Please enter a valid postcode, for example SY23 3AN.";
const INVALID_PICKUP_DATE_MESSAGE =
  "Please enter a valid date in DD/MM/YYYY format.";
const SELECT_BANK_MESSAGE =
  "Please choose a food bank before submitting your donation details.";

const buildSearchFeedback = (
  normalizedPostcode: string,
  resultCount: number,
) =>
  resultCount === 0
    ? `We could not find any food banks within ${LOCAL_FOOD_BANK_SEARCH_RADIUS_KM} km of ${normalizedPostcode}.`
    : `Showing food banks within ${LOCAL_FOOD_BANK_SEARCH_RADIUS_KM} km of ${normalizedPostcode}.`;

const getNormalizedPostcode = (value: string) =>
  normalizeWhitespace(value).toUpperCase();

const updateFieldErrorsForField = (
  current: FieldErrors,
  field: keyof DonationDetails,
  value: string,
) => {
  const nextErrors = { ...current };

  if (field === "pickupDate") {
    const pickupDateError = getPickupDateError(value);
    if (pickupDateError) {
      nextErrors[field] = pickupDateError;
    } else {
      delete nextErrors[field];
    }
    return nextErrors;
  }

  if (field === "phone") {
    const phoneError = getPhoneError(value);
    if (phoneError) {
      nextErrors[field] = phoneError;
    } else {
      delete nextErrors[field];
    }
    return nextErrors;
  }

  if (!current[field]) {
    return current;
  }

  delete nextErrors[field];
  return nextErrors;
};

const createGoodsDonationPayload = ({
  details,
  postcode,
  parsedPickupDate,
  selectedBank,
}: {
  details: DonationDetails;
  postcode: string;
  parsedPickupDate: NonNullable<ReturnType<typeof parsePickupDate>>;
  selectedBank: FoodBankOption;
}) => ({
  food_bank_id: selectedBank.foodBankId ?? undefined,
  food_bank_email: selectedBank.foodBankEmail?.trim() || undefined,
  food_bank_name: selectedBank.name,
  food_bank_address: selectedBank.address,
  donor_name: details.name.trim(),
  donor_email: details.email.trim(),
  donor_phone: details.phone.trim(),
  postcode: postcode.trim().toUpperCase(),
  pickup_date: parsedPickupDate.isoDate,
  item_condition: details.condition,
  estimated_quantity: details.quantity.trim() || undefined,
  notes: details.notes.trim() || undefined,
  items: [
    {
      item_name: details.items.trim(),
      quantity: estimateQuantity(details.quantity),
    },
  ],
});

const buildSubmitSuccessMessage = (
  details: DonationDetails,
  selectedBank: FoodBankOption,
) =>
  `Thanks, ${details.name.trim()}. Your donation request has been sent to ${selectedBank.name}. Their team will contact you at ${details.email.trim()} to arrange collection or drop-off.`;

export function useDonateGoodsPageModel() {
  const [step, setStep] = useState(1);
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [searchResults, setSearchResults] = useState<FoodBankOption[]>([]);
  const [selectedBank, setSelectedBank] = useState<FoodBankOption | null>(null);
  const [details, setDetails] = useState<DonationDetails>(INITIAL_DETAILS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitFeedback, setSubmitFeedback] = useState<FeedbackState | null>(
    null,
  );
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const changePostcode = (value: string) => {
    setPostcode(value);
    setPostcodeError("");
    setSearchFeedback(null);
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitFeedback(null);
    setSearchFeedback(null);

    const normalizedPostcode = getNormalizedPostcode(postcode);
    if (!UK_POSTCODE_PATTERN.test(normalizedPostcode)) {
      setPostcodeError(INVALID_POSTCODE_MESSAGE);
      return;
    }

    setPostcodeError("");
    setPostcode(normalizedPostcode);
    setSelectedBank(null);
    setSearching(true);

    try {
      // 在进入选择步骤前,先解析用户位置并与已知食物银行记录合并。
      const [userCoords, internalBanksResponse, nearbyBanks] = await Promise.all(
        [
          getCoordinatesFromPostcode(normalizedPostcode),
          foodBanksAPI.getFoodBanks(),
          getNearbyFoodbanks(normalizedPostcode),
        ],
      );

      const rankedResults = buildRankedFoodBankOptions({
        userCoords,
        internalBanks: internalBanksResponse.items ?? [],
        nearbyBanks,
        localSearchRadiusKm: LOCAL_FOOD_BANK_SEARCH_RADIUS_KM,
      });

      setSearchResults(rankedResults);
      setSearchFeedback(
        buildSearchFeedback(normalizedPostcode, rankedResults.length),
      );
      setStep(2);
    } catch (error) {
      setSearchResults([]);
      setStep(1);
      setPostcodeError(
        getFoodBankLookupErrorMessage(error, BACKEND_API_UNAVAILABLE_MESSAGE),
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBank = (bank: FoodBankOption) => {
    setSelectedBank(bank);
    setStep(3);
  };

  const updateDetails = (field: keyof DonationDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) =>
      updateFieldErrorsForField(current, field, value),
    );
  };

  const normalizePickupDateField = () => {
    const parsedPickupDate = parsePickupDate(details.pickupDate);
    if (parsedPickupDate && details.pickupDate !== parsedPickupDate.ukDate) {
      updateDetails("pickupDate", parsedPickupDate.ukDate);
    }
  };

  const validateDetails = () => {
    const nextErrors = validateGoodsDonationDetails(details);
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmitDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitFeedback(null);

    if (!selectedBank) {
      setSubmitFeedback({ type: "error", message: SELECT_BANK_MESSAGE });
      return;
    }

    if (!validateDetails()) {
      return;
    }

    const parsedPickupDate = parsePickupDate(details.pickupDate);
    if (!parsedPickupDate) {
      setFieldErrors((current) => ({
        ...current,
        pickupDate: INVALID_PICKUP_DATE_MESSAGE,
      }));
      return;
    }

    setSubmitting(true);

    try {
      // 后端校验仍具有最终决定权,但会将常见失败映射回捐赠者可修改的字段。
      await donationsAPI.donateGoods(
        createGoodsDonationPayload({
          details,
          postcode,
          parsedPickupDate,
          selectedBank,
        }),
      );
      setFieldErrors({});
      setDetails(INITIAL_DETAILS);
      setSubmitFeedback({
        type: "success",
        message: buildSubmitSuccessMessage(details, selectedBank),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (/at least 3 characters/i.test(error.message)) {
          setFieldErrors((current) => ({
            ...current,
            phone: "Phone number must be at least 3 characters.",
          }));
          return;
        }

        if (
          /pickup date on or after today/i.test(error.message) ||
          /valid date/i.test(error.message)
        ) {
          setFieldErrors((current) => ({
            ...current,
            pickupDate:
              getPickupDateError(details.pickupDate) ||
              "Please enter a valid date on or after today.",
          }));
          return;
        }
      }

      setSubmitFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit your donation right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    details,
    fieldErrors,
    postcode,
    postcodeError,
    searchFeedback,
    searchResults,
    searching,
    selectedBank,
    step,
    submitFeedback,
    submitting,
    changePostcode,
    goToSearchStep: () => setStep(1),
    goToSelectBankStep: () => setStep(2),
    handleSearch,
    handleSelectBank,
    handleSubmitDonation,
    normalizePickupDateField,
    updateDetails,
  };
}

export type DonateGoodsPageModel = ReturnType<typeof useDonateGoodsPageModel>;

import {
  foodBanksAPI,
  type ExternalFoodBankRecord,
} from "@/shared/lib/api/foodBanks";
import {
  formatDistanceMiles,
  haversineDistanceKm,
  kilometersToMiles,
} from "@/shared/lib/geo";
import type { FoodBank } from "@/shared/types/foodBanks";
import {
  buildFoodBankDisplayAddress,
  findInternalFoodBankMatch,
  normalizeWhitespace,
} from "@/shared/lib/foodBankAddress";

export const LOCAL_FOOD_BANK_SEARCH_RADIUS_KM = 5;
const FEED_CACHE_TTL_MS = 10 * 60 * 1000;
export const BACKEND_API_UNAVAILABLE_MESSAGE =
  "Food bank lookup service is temporarily unavailable.";
export interface NearbyFoodBank {
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  url?: string;
  needs?: string[];
  distance: number;
}

export type FoodBankOption = {
  id: string;
  foodBankId?: number | null;
  foodBankEmail?: string;
  name: string;
  address: string;
  postcode: string;
  distance: string;
  distanceMiles: number;
};

export interface ResolvedNearbyFoodBank extends FoodBank {
  postcode: string;
  has_local_admin_account: boolean;
  systemMatched: boolean;
}

type SearchCoordinates = { lat: number; lng: number };
type InternalFoodBankSource = {
  id: number | string;
  name: string;
  address: string;
  lat?: number | string | null;
  lng?: number | string | null;
  notification_email?: string | null;
  has_local_admin_account?: boolean | null;
};
type NearbyInternalFoodBank = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  notification_email?: string | null;
  has_local_admin_account: boolean;
  distance: number;
};

let cachedFoodbanks: ExternalFoodBankRecord[] | null = null;
let cachedFoodbanksAt = 0;
let inFlightFoodbanksRequest: Promise<ExternalFoodBankRecord[]> | null = null;
const postcodeCache = new Map<string, { lat: number; lng: number }>();
function extractErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error.trim();
  }
  if (error instanceof Error) {
    return error.message.trim();
  }
  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message.trim();
    }
    if ("detail" in error && typeof error.detail === "string") {
      return error.detail.trim();
    }
  }
  return "";
}
export function getFoodBankLookupErrorMessage(
  error: unknown,
  backendUnavailableMessage = BACKEND_API_UNAVAILABLE_MESSAGE,
) {
  const message = extractErrorMessage(error);
  if (!message) {
    return backendUnavailableMessage;
  }
  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes("temporarily unavailable") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("network error") ||
    normalizedMessage.includes("network request failed")
  ) {
    return backendUnavailableMessage;
  }
  if (normalizedMessage.includes("invalid postcode")) {
    return "We could not find that postcode. Please check it and try again.";
  }
  return message;
}
export async function getCoordinatesFromPostcode(
  postcode: string,
): Promise<{ lat: number; lng: number }> {
  const normalizedPostcode = postcode.trim();
  const cachedCoords = postcodeCache.get(normalizedPostcode.toUpperCase());
  if (cachedCoords) {
    return cachedCoords;
  }
  const payload = await foodBanksAPI.geocodePostcode(normalizedPostcode);
  const coords = { lat: payload.lat, lng: payload.lng };
  postcodeCache.set(normalizedPostcode.toUpperCase(), coords);
  return coords;
}
async function getAllFoodbanks(): Promise<ExternalFoodBankRecord[]> {
  const now = Date.now();
  // 缓存 + in-flight 去重,防重复打外部源
  if (cachedFoodbanks && now - cachedFoodbanksAt < FEED_CACHE_TTL_MS) {
    return cachedFoodbanks;
  }
  if (inFlightFoodbanksRequest) {
    return inFlightFoodbanksRequest;
  }
  inFlightFoodbanksRequest = (async () => {
    const payload = await foodBanksAPI.getExternalFeed();
    cachedFoodbanks = payload;
    cachedFoodbanksAt = Date.now();
    return payload;
  })();
  try {
    return await inFlightFoodbanksRequest;
  } finally {
    inFlightFoodbanksRequest = null;
  }
}
function parseCoordinates(
  foodbank: ExternalFoodBankRecord,
): { lat: number; lng: number } | null {
  if (typeof foodbank.lat === "number" && typeof foodbank.lng === "number") {
    return { lat: foodbank.lat, lng: foodbank.lng };
  }
  if (!foodbank.latt_long) {
    return null;
  }
  const [latStr, lngStr] = foodbank.latt_long.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}
async function getRankedFoodbanksFromCoords(userCoords: {
  lat: number;
  lng: number;
}): Promise<NearbyFoodBank[]> {
  const allFoodbanks = await getAllFoodbanks();
  return allFoodbanks
    .flatMap((foodbank) => {
      const coords = parseCoordinates(foodbank);
      if (!coords) {
        return [];
      }
      return [
        {
          ...foodbank,
          lat: coords.lat,
          lng: coords.lng,
          distance: haversineDistanceKm(
            userCoords.lat,
            userCoords.lng,
            coords.lat,
            coords.lng,
          ),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
}
async function getRankedFoodbanks(postcode: string): Promise<NearbyFoodBank[]> {
  const userCoords = await getCoordinatesFromPostcode(postcode);
  return getRankedFoodbanksFromCoords(userCoords);
}

function mapInternalFoodBanks(
  internalBanks: readonly InternalFoodBankSource[],
  userCoords: SearchCoordinates,
  localSearchRadiusKm: number,
): NearbyInternalFoodBank[] {
  return internalBanks
    .flatMap((bank) => {
      const id = Number(bank.id);
      const lat = Number(bank.lat);
      const lng = Number(bank.lng);

      if (
        !Number.isFinite(id) ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return [];
      }

      const distanceKm = haversineDistanceKm(
        userCoords.lat,
        userCoords.lng,
        lat,
        lng,
      );

      if (distanceKm > localSearchRadiusKm) {
        return [];
      }

      return [
        {
          id,
          name: bank.name,
          address: bank.address,
          lat,
          lng,
          notification_email:
            typeof bank.notification_email === "string"
              ? bank.notification_email
              : null,
          has_local_admin_account: Boolean(bank.has_local_admin_account),
          distance: distanceKm,
        } satisfies NearbyInternalFoodBank,
      ];
    })
    .sort((left, right) => left.distance - right.distance);
}

export function buildResolvedNearbyFoodBanks({
  userCoords,
  internalBanks,
  nearbyBanks,
  localSearchRadiusKm = LOCAL_FOOD_BANK_SEARCH_RADIUS_KM,
}: {
  userCoords: SearchCoordinates;
  internalBanks: readonly InternalFoodBankSource[];
  nearbyBanks: readonly NearbyFoodBank[];
  localSearchRadiusKm?: number;
}): ResolvedNearbyFoodBank[] {
  const nearbyInternalBanks = mapInternalFoodBanks(
    internalBanks,
    userCoords,
    localSearchRadiusKm,
  );
  const matchedInternalBankIds = new Set<number>();

  return nearbyBanks
    .map((bank) => {
      const displayAddress = buildFoodBankDisplayAddress(
        bank.address,
        bank.postcode,
      );
      const matchedInternalBank = findInternalFoodBankMatch(
        { name: bank.name, address: displayAddress },
        nearbyInternalBanks,
      );

      if (matchedInternalBank) {
        matchedInternalBankIds.add(matchedInternalBank.id);
      }

      // 外部行能可信地匹配到本地管理记录时,优先使用内部的名称、地址和联系方式
      return {
        id: matchedInternalBank
          ? matchedInternalBank.id
          : -1,
        name: matchedInternalBank?.name ?? bank.name,
        address: matchedInternalBank?.address ?? displayAddress,
        notification_email:
          matchedInternalBank?.notification_email?.trim() || undefined,
        has_local_admin_account: Boolean(
          matchedInternalBank?.has_local_admin_account,
        ),
        distance: bank.distance,
        lat: bank.lat,
        lng: bank.lng,
        phone: bank.phone,
        email: bank.email,
        url: bank.url,
        postcode: bank.postcode,
        systemMatched: Boolean(matchedInternalBank),
      } satisfies ResolvedNearbyFoodBank;
    })
    .concat(
      // 将搜索半径内未匹配的内部食物银行追加到结果,即使外部数据源未收录也能展示
      nearbyInternalBanks
        .filter((bank) => !matchedInternalBankIds.has(bank.id))
        .map((bank) => {
          return {
            id: bank.id,
            name: bank.name,
            address: normalizeWhitespace(bank.address),
            notification_email: bank.notification_email?.trim() || undefined,
            has_local_admin_account: bank.has_local_admin_account,
            distance: bank.distance,
            lat: bank.lat,
            lng: bank.lng,
            phone: undefined,
            email: undefined,
            url: undefined,
            postcode: "",
            systemMatched: true,
          } satisfies ResolvedNearbyFoodBank;
        }),
    )
    .sort((left, right) => left.distance - right.distance);
}

export function buildRankedFoodBankOptions({
  userCoords,
  internalBanks,
  nearbyBanks,
  localSearchRadiusKm = LOCAL_FOOD_BANK_SEARCH_RADIUS_KM,
}: {
  userCoords: SearchCoordinates;
  internalBanks: readonly InternalFoodBankSource[];
  nearbyBanks: readonly NearbyFoodBank[];
  localSearchRadiusKm?: number;
}): FoodBankOption[] {
  return buildResolvedNearbyFoodBanks({
    userCoords,
    internalBanks,
    nearbyBanks,
    localSearchRadiusKm,
  }).map((bank) => ({
    id:
      bank.id > 0
        ? `internal-${bank.id}`
        : `${bank.name}-${bank.postcode}-${bank.lat}-${bank.lng}`,
    foodBankId: bank.id > 0 ? bank.id : undefined,
    foodBankEmail: bank.notification_email?.trim() || bank.email,
    name: bank.name,
    address: bank.address,
    postcode: bank.postcode,
    distance: formatDistanceMiles(bank.distance ?? 0),
    distanceMiles: kilometersToMiles(bank.distance ?? 0),
  }));
}

export async function getNearbyFoodbanks(
  postcode: string,
): Promise<NearbyFoodBank[]> {
  const rankedByDistance = await getRankedFoodbanks(postcode);
  return rankedByDistance.filter(
    (foodbank) => foodbank.distance <= LOCAL_FOOD_BANK_SEARCH_RADIUS_KM,
  );
}

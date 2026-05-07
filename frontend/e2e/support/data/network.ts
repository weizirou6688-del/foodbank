export type FoodBankDirectoryEntry = {
  id: number;
  name: string;
  address: string;
  notification_email: string;
  has_local_admin_account: boolean;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  url: string;
  systemMatched: boolean;
};

export type ExternalFoodBankEntry = {
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  url: string;
  needs: string[];
};

const foodBankDirectory: FoodBankDirectoryEntry[] = [
  {
    id: 1,
    name: "Jubilee Storehouse",
    address: "12 Bridge Street, London SW1A 1AA",
    notification_email: "jubilee-notify@foodbank.test",
    has_local_admin_account: true,
    lat: 51.5009,
    lng: -0.1412,
    phone: "020 7946 0011",
    email: "hello@jubilee.foodbank.test",
    url: "https://jubilee.foodbank.test",
    systemMatched: true,
  },
  {
    id: 2,
    name: "Southside Family Pantry",
    address: "85 River Road, London SW1A 2AA",
    notification_email: "southside-notify@foodbank.test",
    has_local_admin_account: false,
    lat: 51.4988,
    lng: -0.1365,
    phone: "020 7946 0022",
    email: "hello@southside.foodbank.test",
    url: "https://southside.foodbank.test",
    systemMatched: true,
  },
];

const externalFoodBankFeed: ExternalFoodBankEntry[] = [
  {
    name: "Jubilee Storehouse",
    address: "12 Bridge Street, London",
    postcode: "SW1A 1AA",
    lat: 51.5009,
    lng: -0.1412,
    phone: "020 7946 0011",
    email: "hello@jubilee.foodbank.test",
    url: "https://jubilee.foodbank.test",
    needs: ["Tinned food", "Toiletries"],
  },
  {
    name: "Southside Family Pantry",
    address: "85 River Road, London",
    postcode: "SW1A 2AA",
    lat: 51.4988,
    lng: -0.1365,
    phone: "020 7946 0022",
    email: "hello@southside.foodbank.test",
    url: "https://southside.foodbank.test",
    needs: ["Rice", "Pasta"],
  },
];

export const geocodeResult = {
  lat: 51.5007,
  lng: -0.1415,
  source: "playwright",
} as const;

export const listFoodBankDirectory = (): FoodBankDirectoryEntry[] =>
  foodBankDirectory.map((bank) => ({ ...bank }));

export const findFoodBankDirectoryEntry = (
  foodBankId: number,
): FoodBankDirectoryEntry | undefined =>
  foodBankDirectory.find((bank) => bank.id === foodBankId);

export const listExternalFoodBankFeed = (): ExternalFoodBankEntry[] =>
  externalFoodBankFeed.map((bank) => ({
    ...bank,
    needs: [...bank.needs],
  }));

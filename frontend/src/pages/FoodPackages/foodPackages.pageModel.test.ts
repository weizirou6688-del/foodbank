import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useAuthStore } from "@/app/store/authStore";
import { useFoodBankStore } from "@/app/store/foodBankStore";
import type { UserApplicationRecord } from "@/shared/lib/api/applications";
import type {
  FoodBankState,
  FoodPackage,
} from "@/app/store/foodBankStore.types";
import type { FoodBank } from "@/shared/types/foodBanks";
import type { InventoryItem } from "@/shared/types/inventory";
import { MAX_INDIVIDUAL, useFoodPackagesPageModel } from "./foodPackages.pageModel";

const selectedFoodBank: FoodBank = {
  id: 1,
  name: "Jubilee Storehouse",
  address: "12 Bridge Street, London SW1A 1AA",
  lat: 51.5009,
  lng: -0.1412,
};

const signedInPublicUser = {
  id: "user-public-1",
  name: "Taylor Public",
  email: "user@example.com",
  role: "public" as const,
  food_bank_id: null,
  food_bank_name: null,
};

const familyEssentialsBox: FoodPackage = {
  id: 101,
  name: "Family Essentials Box",
  category: "Weekly Support",
  description: "Seven days of pantry basics for a small household.",
  items: [{ name: "Rice", qty: 2 }],
  stock: 5,
  threshold: 2,
  appliedCount: 12,
  image: "",
};

type ApplyPackagesAction = FoodBankState["applyPackages"];
type LoadUserCollectionsAction = FoodBankState["loadUserCollections"];
type LoadPackagesAction = FoodBankState["loadPackages"];
type LoadAvailableItemsAction = FoodBankState["loadAvailableItems"];

function createApplyPackagesMock(code = "ABCD-1234") {
  return vi.fn<ApplyPackagesAction>(async () => ({
    success: true as const,
    message: "Application successful!",
    code,
  }));
}

async function renderPageModel({
  user = null,
  weeklyCollected = 0,
  packages = [],
  availableItems = [],
  userApplications = [],
  applyPackages = createApplyPackagesMock(),
  loadUserCollections = vi.fn<LoadUserCollectionsAction>(async () => {}),
}: {
  user?: {
    id: string;
    name: string;
    email: string;
    role: "public";
    food_bank_id: null;
    food_bank_name: null;
  } | null;
  weeklyCollected?: number;
  packages?: FoodPackage[];
  availableItems?: InventoryItem[];
  userApplications?: UserApplicationRecord[];
  applyPackages?: ApplyPackagesAction;
  loadUserCollections?: LoadUserCollectionsAction;
} = {}) {
  useAuthStore.setState({
    user,
    isAuthenticated: Boolean(user),
    accessToken: user ? "public-token" : null,
  });

  useFoodBankStore.setState({
    selectedFoodBank,
    packages,
    availableItems,
    userApplications,
    weeklyCollected,
    loadUserCollections,
    loadPackages: vi.fn<LoadPackagesAction>(async () => {}),
    loadAvailableItems: vi.fn<LoadAvailableItemsAction>(async () => {}),
    applyPackages,
  });

  const rendered = renderHook(() => useFoodPackagesPageModel());
  await waitFor(() => expect(rendered.result.current.isBootstrapping).toBe(false));

  return { ...rendered, applyPackages, loadUserCollections };
}

afterEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    accessToken: null,
  });
  useFoodBankStore.setState({
    selectedFoodBank: null,
    packages: [],
    availableItems: [],
    userApplications: [],
    weeklyCollected: 0,
  });
});

describe("useFoodPackagesPageModel", () => {
  describe("package limits", () => {
    test("only allows the remaining weekly package slots to be selected", async () => {
      const { result } = await renderPageModel({
        user: signedInPublicUser,
        weeklyCollected: 2,
        packages: [familyEssentialsBox],
      });

      expect(result.current.remainingPackageSlots).toBe(1);
      expect(result.current.packageLimitReached).toBe(false);

      act(() => {
        result.current.changePkgQty(101, 1, 5);
        result.current.changePkgQty(101, 1, 5);
      });

      expect(result.current.pkgQty).toEqual({ 101: 1 });
      expect(result.current.totalPkgs).toBe(1);
    });

    test("reports the package cap as reached when the week is already full", async () => {
      const { result } = await renderPageModel({
        weeklyCollected: 3,
        packages: [familyEssentialsBox],
      });

      expect(result.current.remainingPackageSlots).toBe(0);
      expect(result.current.packageLimitReached).toBe(true);

      act(() => {
        result.current.changePkgQty(101, 1, 5);
      });

      expect(result.current.pkgQty).toEqual({});
      expect(result.current.totalPkgs).toBe(0);
    });
  });

  describe("individual item limits", () => {
    test("caps both item types and per-item quantity", async () => {
      const availableItems: InventoryItem[] = [
        {
          id: 1001,
          name: "Rice",
          category: "Pantry",
          stock: 8,
          unit: "bags",
          threshold: 1,
        },
        {
          id: 1002,
          name: "Pasta",
          category: "Pantry",
          stock: 4,
          unit: "packs",
          threshold: 1,
        },
        {
          id: 1003,
          name: "Beans",
          category: "Tinned",
          stock: 4,
          unit: "tins",
          threshold: 1,
        },
        {
          id: 1004,
          name: "Milk",
          category: "Dairy",
          stock: 4,
          unit: "cartons",
          threshold: 1,
        },
        {
          id: 1005,
          name: "Cereal",
          category: "Breakfast",
          stock: 4,
          unit: "boxes",
          threshold: 1,
        },
        {
          id: 1006,
          name: "Soup",
          category: "Tinned",
          stock: 4,
          unit: "tins",
          threshold: 1,
        },
      ];
      const { result } = await renderPageModel({ availableItems });

      act(() => {
        result.current.toggleFood("1001");
        result.current.toggleFood("1002");
        result.current.toggleFood("1003");
        result.current.toggleFood("1004");
        result.current.toggleFood("1005");
        result.current.toggleFood("1006");
        result.current.changeFoodQty("1001", 1, 8);
        result.current.changeFoodQty("1001", 1, 8);
        result.current.changeFoodQty("1001", 1, 8);
        result.current.changeFoodQty("1001", 1, 8);
        result.current.changeFoodQty("1001", 1, 8);
      });

      expect(result.current.totalFoods).toBe(MAX_INDIVIDUAL);
      expect(result.current.atFoodLimit).toBe(true);
      expect(result.current.foodSel).toEqual({
        1001: 5,
        1002: 1,
        1003: 1,
        1004: 1,
        1005: 1,
      });
      expect(result.current.summaryTxt).toBe("5 item types (9 units)");
    });
  });

  describe("successful submission", () => {
    test("submits the selected package and shows the redemption code", async () => {
      const applyPackages = createApplyPackagesMock("WXYZ-5678");
      const { result } = await renderPageModel({
        user: signedInPublicUser,
        packages: [familyEssentialsBox],
        applyPackages,
      });

      act(() => {
        result.current.changePkgQty(101, 1, 5);
      });

      await act(async () => {
        await result.current.handleApply();
      });

      expect(applyPackages).toHaveBeenCalledWith(
        [{ packageId: 101, qty: 1 }],
        undefined,
        [],
      );
      expect(result.current.showSuccess).toBe(true);
      expect(result.current.redemptionCode).toBe("WXYZ-5678");
    });
  });

  // page model 在渲染前会裁剪并排序原始历史记录,视图只接收当前食物银行最新的申请。
  describe("application history", () => {
    test("keeps only the newest application records for the selected food bank", async () => {
      const userApplications: UserApplicationRecord[] = [
        {
          id: "bank-2-latest",
          user_id: "user-public-1",
          food_bank_id: 2,
          redemption_code: "BANK-2001",
          status: "pending",
          week_start: "2026-04-20",
          total_quantity: 1,
          created_at: "2026-04-25T09:30:00Z",
          updated_at: "2026-04-25T09:30:00Z",
          redeemed_at: null,
          deleted_at: null,
        },
        {
          id: "bank-1-oldest",
          user_id: "user-public-1",
          food_bank_id: 1,
          redemption_code: "BANK-1001",
          status: "expired",
          week_start: "2026-04-06",
          total_quantity: 1,
          created_at: "2026-04-08T09:30:00Z",
          updated_at: "2026-04-08T09:30:00Z",
          redeemed_at: null,
          deleted_at: null,
        },
        {
          id: "bank-1-mid",
          user_id: "user-public-1",
          food_bank_id: 1,
          redemption_code: "BANK-1002",
          status: "collected",
          week_start: "2026-04-13",
          total_quantity: 2,
          created_at: "2026-04-14T09:30:00Z",
          updated_at: "2026-04-14T09:30:00Z",
          redeemed_at: "2026-04-15T10:00:00Z",
          deleted_at: null,
        },
        {
          id: "bank-1-newest",
          user_id: "user-public-1",
          food_bank_id: 1,
          redemption_code: "BANK-1003",
          status: "pending",
          week_start: "2026-04-20",
          total_quantity: 3,
          created_at: "2026-04-21T09:30:00Z",
          updated_at: "2026-04-21T09:30:00Z",
          redeemed_at: null,
          deleted_at: null,
        },
      ];

      const { result } = await renderPageModel({
        user: signedInPublicUser,
        userApplications,
      });

      expect(
        result.current.recentUserApplications.map((application) => application.id),
      ).toEqual(["bank-1-newest", "bank-1-mid", "bank-1-oldest"]);
    });
  });

  describe("empty cart", () => {
    test("does not submit when nothing has been selected", async () => {
      const applyPackages = createApplyPackagesMock();
      const { result } = await renderPageModel({
        user: signedInPublicUser,
        packages: [familyEssentialsBox],
        applyPackages,
      });

      await act(async () => {
        await result.current.handleApply();
      });

      expect(applyPackages).not.toHaveBeenCalled();
    });
  });

  describe("auth state", () => {
    test("loads collection history for signed-in users", async () => {
      const loadUserCollections = vi.fn(async () => {});

      await renderPageModel({
        user: signedInPublicUser,
        packages: [familyEssentialsBox],
        loadUserCollections,
      });

      expect(loadUserCollections).toHaveBeenCalled();
    });

    test("blocks submission for signed-out users", async () => {
      const applyPackages = createApplyPackagesMock();
      const { result, loadUserCollections } = await renderPageModel({
        packages: [familyEssentialsBox],
        applyPackages,
      });

      act(() => {
        result.current.changePkgQty(101, 1, 5);
      });

      await act(async () => {
        await result.current.handleApply();
      });

      expect(result.current.hasAny).toBe(true);
      expect(loadUserCollections).not.toHaveBeenCalled();
      expect(applyPackages).not.toHaveBeenCalled();
    });
  });
});

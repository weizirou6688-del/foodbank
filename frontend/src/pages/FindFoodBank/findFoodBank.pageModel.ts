import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/app/store/authStore";
import { useFoodBankStore } from "@/app/store/foodBankStore";
import { useLoginModalController } from "@/features/auth/components/loginModal.model";
import type { FoodBank } from "@/shared/types/foodBanks";
import {
  RESULTS_PER_PAGE,
  canViewFoodBankPackages,
  getDisplayedResults,
  getSelectedFoodBankKey,
  getFoodBankKey,
  getSummaryText,
} from "./findFoodBank.shared";

export function useFindFoodBankPageModel() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    searchResults,
    searchedLocation,
    hasSearched,
    isSearching,
    searchError,
    searchFoodBanks,
    selectFoodBank,
  } = useFoodBankStore();
  const [localPostcode, setLocalPostcode] = useState("");
  const [selectedFoodBankKey, setSelectedFoodBankKey] = useState<string | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const loginModal = useLoginModalController({
    initialTab: "signin",
    redirectTo: "/food-packages",
  });

  useEffect(() => {
    setCurrentPage(1);
    setSelectedFoodBankKey((current) =>
      getSelectedFoodBankKey(searchResults, current),
    );
  }, [searchResults]);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = localPostcode.trim();
    if (!trimmed) {
      return;
    }

    await searchFoodBanks(trimmed);
  };

  const handleSelectFoodBank = (foodBank: FoodBank) => {
    setSelectedFoodBankKey(getFoodBankKey(foodBank));
  };

  const handleViewPackages = (foodBank: FoodBank) => {
    if (!canViewFoodBankPackages(foodBank)) {
      return;
    }

    selectFoodBank(foodBank);
    if (!isAuthenticated) {
      loginModal.openSignIn();
      return;
    }

    navigate("/food-packages");
  };

  const totalPages = Math.max(
    1,
    Math.ceil(searchResults.length / RESULTS_PER_PAGE),
  );
  const displayedResults = getDisplayedResults(searchResults, currentPage);
  const summary = getSummaryText(
    hasSearched,
    searchResults.length,
    localPostcode,
  );

  return {
    currentPage,
    displayedResults,
    hasSearched,
    isSearching,
    localPostcode,
    loginModalProps: loginModal.modalProps,
    searchError,
    searchedLocation,
    searchResults,
    selectedFoodBankKey,
    summary,
    totalPages,
    changePostcode: setLocalPostcode,
    goToPage: setCurrentPage,
    handleSearchSubmit,
    handleSelectFoodBank,
    handleViewPackages,
  };
}

export type FindFoodBankPageModel = ReturnType<typeof useFindFoodBankPageModel>;

import LoginModal from "@/features/auth/components/LoginModal";
import PublicPageShell from "@/shared/ui/PublicPageShell";
import {
  FindFoodBankHeroSection,
  FindFoodBankResultsLayout,
  FindFoodBankSearchPanel,
} from "./FindFoodBank.sections";
import { useFindFoodBankPageModel } from "./findFoodBank.pageModel";
import styles from "./FindFoodBank.module.css";

export default function FindFoodBank() {
  const model = useFindFoodBankPageModel();
  const {
    currentPage,
    displayedResults,
    hasSearched,
    isSearching,
    localPostcode,
    loginModalProps,
    searchError,
    searchedLocation,
    searchResults,
    selectedFoodBankKey,
    summary,
    totalPages,
    changePostcode,
    goToPage,
    handleSearchSubmit,
    handleSelectFoodBank,
    handleViewPackages,
  } = model;

  return (
    <>
      <PublicPageShell>
        <FindFoodBankHeroSection />
        <div className={styles.pageBody}>
          <FindFoodBankSearchPanel
            isSearching={isSearching}
            localPostcode={localPostcode}
            onChangePostcode={changePostcode}
            onSubmit={handleSearchSubmit}
          />
          <FindFoodBankResultsLayout
            currentPage={currentPage}
            displayedResults={displayedResults}
            hasSearched={hasSearched}
            onChangePage={goToPage}
            onSelectFoodBank={handleSelectFoodBank}
            onViewPackages={handleViewPackages}
            searchedLocation={searchedLocation}
            searchError={searchError}
            searchResults={searchResults}
            selectedFoodBankKey={selectedFoodBankKey}
            summary={summary}
            totalPages={totalPages}
          />
        </div>
      </PublicPageShell>
      <LoginModal {...loginModalProps} />
    </>
  );
}

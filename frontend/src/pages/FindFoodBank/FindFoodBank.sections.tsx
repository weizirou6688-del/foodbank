import { type FormEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  Mail,
  MapPinned,
  Navigation,
  PackageOpen,
  PackageSearch,
  PhoneCall,
  Search,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { ChevronLeft, ChevronRight } from "@/shared/ui/InlineIcons";
import { formatDistanceKilometers } from "@/shared/lib/geo";
import type { FoodBank } from "@/shared/types/foodBanks";
import {
  ActionButton,
  PublicPagination,
  PublicSearchPanel,
  PublicSectionIntro,
} from "@/shared/ui/PublicPagePatterns";
import FoodBankMap from "./FoodBankMap";
import {
  canViewFoodBankPackages,
  getFoodBankKey,
} from "./findFoodBank.shared";
import styles from "./FindFoodBank.module.css";

const getSecondaryLine = (foodBank: FoodBank) =>
  canViewFoodBankPackages(foodBank)
    ? "Local package inventory available"
    : "No linked local admin account for online package viewing yet";

const getDistanceLabel = (foodBank: FoodBank) =>
  typeof foodBank.distance === "number"
    ? `${formatDistanceKilometers(foodBank.distance)} away`
    : "Nearby location";

function DetailRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.detailRow}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

function FoodBankResultCard({
  foodBank,
  isSelected,
  onSelect,
  onViewPackages,
}: {
  foodBank: FoodBank;
  isSelected: boolean;
  onSelect: () => void;
  onViewPackages: (foodBank: FoodBank) => void;
}) {
  const canViewPackages = canViewFoodBankPackages(foodBank);
  // 套餐浏览仅对已绑定本地管理账户的食物银行开放,
  // 但为了便于用户发现,仍然展示更大范围的搜索结果。
  const details = [
    {
      key: "address",
      icon: <MapPinned className={styles.detailIcon} />,
      text: foodBank.address,
    },
    {
      key: "status",
      icon: <PackageSearch className={styles.detailIcon} />,
      text: getSecondaryLine(foodBank),
    },
    ...(foodBank.phone || foodBank.email
      ? [
          {
            key: "contact",
            icon: foodBank.phone ? (
              <PhoneCall className={styles.detailIcon} />
            ) : (
              <Mail className={styles.detailIcon} />
            ),
            text: foodBank.phone ?? foodBank.email ?? "",
          },
        ]
      : []),
    {
      key: "distance",
      icon: <Navigation className={styles.detailIcon} />,
      text: getDistanceLabel(foodBank),
    },
  ];

  return (
    <article
      className={cn(styles.resultCard, isSelected && styles.resultCardSelected)}
      onClick={onSelect}
    >
      <h4 className={styles.resultCardTitle}>
        <div className={styles.resultCardTitleText}>
          {foodBank.url ? (
            <a
              href={foodBank.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className={styles.resultCardLink}
            >
              {foodBank.name}
              <ArrowUpRight className={styles.inlineIcon} />
            </a>
          ) : (
            foodBank.name
          )}
        </div>
      </h4>
      <div className={styles.resultCardBody}>
        {details.map(({ key, icon, text }) => (
          <DetailRow key={key} icon={icon}>
            {text}
          </DetailRow>
        ))}
        <div className={styles.actionsRow}>
          <ActionButton
            tone="outline"
            size="sm"
            disabled={!canViewPackages}
            title={
              canViewPackages
                ? undefined
                : "This food bank does not have a linked local admin account yet."
            }
            onClick={(event) => {
              event.stopPropagation();
              if (canViewPackages) {
                onViewPackages(foodBank);
              }
            }}
            className={cn(
              styles.resultActionButton,
              styles.resultActionButtonOutline,
            )}
            iconStart={<PackageOpen className={styles.inlineIcon} />}
          >
            View packages
          </ActionButton>
          <ActionButton
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(foodBank.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            tone="primary"
            size="sm"
            className={styles.resultActionButton}
            iconStart={<Navigation className={styles.inlineIcon} />}
          >
            Google Maps
          </ActionButton>
        </div>
      </div>
    </article>
  );
}

export function FindFoodBankHeroSection() {
  return (
    <div className={styles.pageHero}>
      <div className={styles.pageHeroInner}>
        <PublicSectionIntro
          title={
            <>
              Find a food bank{" "}
              <span className={styles.pageTitleAccent}>near you</span>
            </>
          }
          description="Search by postcode to see nearby foodbank locations within 5kms."
          descriptionExtraLine="Only food banks linked to a local admin account can open the package inventory page."
          titleAs="h1"
          size="hero"
          className={styles.pageHeroIntro}
        />
      </div>
    </div>
  );
}

export function FindFoodBankSearchPanel({
  isSearching,
  localPostcode,
  onChangePostcode,
  onSubmit,
}: {
  isSearching: boolean;
  localPostcode: string;
  onChangePostcode: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <PublicSearchPanel
      title="Search by postcode"
      description="Enter your postcode to find nearby food banks"
      value={localPostcode}
      onChange={onChangePostcode}
      onSubmit={onSubmit}
      placeholder="e.g., SW1A 1AA"
      submitLabel="Find Food Banks"
      submittingLabel="Searching..."
      isSubmitting={isSearching}
      icon={<Search className={styles.searchIcon} />}
      className={styles.searchPanel}
      introClassName={styles.searchPanelIntro}
      inputProps={{ type: "text", "aria-label": "Postcode" }}
    />
  );
}

export function FindFoodBankResultsLayout({
  currentPage,
  displayedResults,
  hasSearched,
  onChangePage,
  onSelectFoodBank,
  onViewPackages,
  searchedLocation,
  searchError,
  searchResults,
  selectedFoodBankKey,
  summary,
  totalPages,
}: {
  currentPage: number;
  displayedResults: FoodBank[];
  hasSearched: boolean;
  onChangePage: (page: number) => void;
  onSelectFoodBank: (foodBank: FoodBank) => void;
  onViewPackages: (foodBank: FoodBank) => void;
  searchedLocation: { lat: number; lng: number } | null;
  searchError: string | null;
  searchResults: FoodBank[];
  selectedFoodBankKey: string | null;
  summary: string;
  totalPages: number;
}) {
  return (
    <div className={styles.contentGrid}>
      <div className={styles.mapColumn}>
        <div className={styles.mapPanel}>
          <h3 className={styles.panelTitle}>Food bank locations</h3>
          <div className={styles.mapBody}>
            {/* 即使卡片已分页,地图仍保持对完整结果集的展示,
                以确保标记选中与当前页保持一致。 */}
            <FoodBankMap
              foodBanks={searchResults}
              searchedLocation={searchedLocation}
              selectedFoodBankKey={selectedFoodBankKey}
              onSelectFoodBank={onSelectFoodBank}
            />
          </div>
        </div>
      </div>
      <div>
        <div className={styles.resultsPanel}>
          <div className={styles.resultsHeader}>
            <h3 className={styles.panelTitle}>Nearby food banks</h3>
            <p className={styles.summaryText}>{summary}</p>
          </div>
          <div className={styles.resultsStack}>
            {displayedResults.map((foodBank) => {
              const key = getFoodBankKey(foodBank);
              return (
                <FoodBankResultCard
                  key={key}
                  foodBank={foodBank}
                  isSelected={selectedFoodBankKey === key}
                  onSelect={() => onSelectFoodBank(foodBank)}
                  onViewPackages={onViewPackages}
                />
              );
            })}
            {hasSearched && searchResults.length === 0 ? (
              searchError ? (
                <p className={styles.errorText}> Search error: {searchError}</p>
              ) : (
                <div className={styles.emptyState}>
                  {" "}
                  No nearby food banks were found for this postcode. Try another
                  postcode or a nearby area.
                </div>
              )
            ) : null}
          </div>
          <PublicPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onChangePage}
            className={styles.pagination}
            previousLabel={
              <>
                <ChevronLeft size={16} /> Previous
              </>
            }
            nextLabel={
              <>
                Next <ChevronRight size={16} />
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

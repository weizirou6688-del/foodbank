import { cn } from "@/shared/lib/cn";
import { scrollToId } from "@/shared/lib/scroll";
import type { FoodPackage } from "@/app/store/foodBankStore.types";
import type { UserApplicationRecord } from "@/shared/lib/api/applications";
import { ImageWithFallback } from "@/shared/ui/ImageWithFallback";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "@/shared/ui/InlineIcons";
import {
  ActionButton,
  PublicBanner,
  PublicPagination,
  PublicSectionIntro,
} from "@/shared/ui/PublicPagePatterns";
import type { InventoryItem } from "@/shared/types/inventory";
import {
  MAX_INDIVIDUAL,
  WEEKLY_COLLECTION_LIMIT,
  type FoodPackagesPageModel,
} from "./foodPackages.pageModel";
import styles from "./FoodPackages.module.css";

const DEFAULT_PKG_IMAGES = [
  "https://images.unsplash.com/photo-1559837957-bab8edc53c85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
  "https://images.unsplash.com/photo-1714224247661-ee250f55a842?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
  "https://images.unsplash.com/photo-1653174577821-9ab410d92d44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
  "https://images.unsplash.com/photo-1599297914860-1ccd36987a52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
];
const applicationDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatApplicationDate(value?: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : applicationDateFormatter.format(parsed);
}

// 公开 UI 将后端生命周期字段收归为一个小型 badge 模型,
// 让用户看到便于取货的状态,而非内部状态细节。
function getApplicationStatusMeta(application: UserApplicationRecord) {
  if (application.deleted_at) {
    return {
      badgeClassName: styles.applicationStatusBadgeVoided,
      label: "Voided",
    };
  }

  if (application.status === "collected") {
    return {
      badgeClassName: styles.applicationStatusBadgeCollected,
      label: "Collected",
    };
  }

  if (application.status === "expired") {
    return {
      badgeClassName: styles.applicationStatusBadgeExpired,
      label: "Expired",
    };
  }

  return {
    badgeClassName: styles.applicationStatusBadgePending,
    label: "Pending collection",
  };
}

// 放在现有受保护的目录路由内,是在不引入独立页面流的前提下
// 添加状态跟踪的最小方案。
function FoodPackagesApplicationStatusSection({
  applications,
  foodBankName,
}: {
  applications: UserApplicationRecord[];
  foodBankName: string;
}) {
  return (
    <div className={styles.section}>
      <PublicSectionIntro
        title="My Application Status"
        description={`Track your recent requests for ${foodBankName} and keep your redemption code ready when collecting support.`}
        titleAs="h2"
        size="compact"
        align="left"
        className={styles.sectionIntro}
      />

      {applications.length === 0 ? (
        <div className={styles.emptyCard}>
          You have not submitted any applications to {foodBankName} yet.
        </div>
      ) : (
        <div className={styles.applicationStatusList}>
          {applications.map((application) => {
            const { badgeClassName, label } =
              getApplicationStatusMeta(application);
            // 申请一旦被作废或已核销,具体事件日期比单纯重复原始状态更有参考价值。
            const resolvedDate = application.deleted_at
              ? formatApplicationDate(application.deleted_at)
              : application.redeemed_at
                ? formatApplicationDate(application.redeemed_at)
                : null;
            const resolvedLabel = application.deleted_at
              ? "Voided"
              : application.redeemed_at
                ? "Collected"
                : null;

            return (
              <article
                key={application.id}
                className={styles.applicationStatusCard}
              >
                <div className={styles.applicationStatusHeader}>
                  <div className={styles.applicationStatusCodeBlock}>
                    <p className={styles.applicationStatusCodeLabel}>
                      Redemption Code
                    </p>
                    <p className={styles.applicationStatusCode}>
                      {application.redemption_code}
                    </p>
                  </div>
                  <span
                    className={cn(
                      styles.applicationStatusBadge,
                      badgeClassName,
                    )}
                  >
                    {label}
                  </span>
                </div>

                <dl className={styles.applicationStatusMeta}>
                  <div className={styles.applicationStatusMetaRow}>
                    <dt>Requested</dt>
                    <dd>{formatApplicationDate(application.created_at)}</dd>
                  </div>
                  <div className={styles.applicationStatusMetaRow}>
                    <dt>Items</dt>
                    <dd>{application.total_quantity}</dd>
                  </div>
                  {resolvedLabel && resolvedDate ? (
                    <div className={styles.applicationStatusMetaRow}>
                      <dt>{resolvedLabel}</dt>
                      <dd>{resolvedDate}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PackageCard({
  interactionsDisabled,
  isAtLimit,
  onChangeQty,
  packageItem,
  pkgQty,
  totalPkgs,
  remainingPackageSlots,
  image,
}: {
  interactionsDisabled: boolean;
  isAtLimit: boolean;
  onChangeQty: (delta: number) => void;
  packageItem: FoodPackage;
  pkgQty: number;
  totalPkgs: number;
  remainingPackageSlots: number;
  image: string;
}) {
  const selected = pkgQty > 0;
  const isLow = packageItem.stock <= packageItem.threshold;
  // 每周套餐限额在整个请求中共用,因此已选中的卡片保持可编辑状态,
  // 只有新选择的才会变暗。
  const atLimit = !selected && totalPkgs >= remainingPackageSlots;
  const canDecreasePackage = !interactionsDisabled && pkgQty > 0;
  const canIncreasePackage =
    !interactionsDisabled && !atLimit && pkgQty < packageItem.stock;

  return (
    <div
      className={cn(
        styles.packageCard,
        selected && styles.packageCardSelected,
        isAtLimit && styles.packageCardDimmed,
      )}
    >
      <div className={styles.packageMedia}>
        <ImageWithFallback
          src={image}
          alt={packageItem.name}
          className={styles.packageImage}
        />
        {isLow ? <div className={styles.packageLowBadge}>Low Stock</div> : null}
        {selected ? (
          <div className={styles.packageSelectedBadge}>
            <Check size={16} stroke="#FFFFFF" strokeWidth={3} />
          </div>
        ) : null}
      </div>
      <div className={styles.packageCardBody}>
        <h4 className={styles.packageName}>{packageItem.name}</h4>
        <div className={styles.packageItems}>
          {packageItem.items.map((item) => (
            <div key={item.name} className={styles.packageItemRow}>
              <span className={styles.packageItemName}>{item.name}</span>
              <span className={styles.packageItemQty}>x{item.qty}</span>
            </div>
          ))}
        </div>
        <div className={styles.packageStockRow}>
          <span className={styles.packageStockLabel}>Available</span>
          <span
            className={cn(
              styles.packageStockValue,
              packageItem.stock < 5 && styles.packageStockValueLow,
            )}
          >
            {packageItem.stock}
          </span>
        </div>
        <div className={styles.packageControls}>
          <button
            onClick={() => onChangeQty(-1)}
            disabled={interactionsDisabled || pkgQty === 0}
            className={cn(
              styles.quantityButton,
              styles.packageQuantityButton,
              canDecreasePackage
                ? styles.quantityButtonEnabled
                : styles.quantityButtonDisabled,
            )}
          >
            <Minus size={16} strokeWidth={2.5} />
          </button>
          <div className={styles.packageQuantityValue}>{pkgQty}</div>
          <button
            onClick={() => onChangeQty(1)}
            disabled={
              interactionsDisabled || atLimit || pkgQty >= packageItem.stock
            }
            className={cn(
              styles.quantityButton,
              styles.packageQuantityButton,
              canIncreasePackage
                ? styles.quantityButtonEnabled
                : styles.quantityButtonDisabled,
            )}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FoodItemCard({
  atFoodLimit,
  food,
  interactionsDisabled,
  onChangeQty,
  onToggle,
  qty,
}: {
  atFoodLimit: boolean;
  food: InventoryItem;
  interactionsDisabled: boolean;
  onChangeQty: (delta: number) => void;
  onToggle: () => void;
  qty: number;
}) {
  const selected = qty > 0;
  const canSelect = selected || !atFoodLimit;
  const canDecreaseFood = !interactionsDisabled;
  const canIncreaseFood =
    !interactionsDisabled && qty < MAX_INDIVIDUAL && qty < food.stock;

  return (
    <div
      className={cn(
        styles.foodCard,
        selected && styles.foodCardSelected,
        !selected && atFoodLimit && styles.foodCardDimmed,
      )}
    >
      <div className={styles.foodRow}>
        <div className={styles.foodMain}>
          <button
            onClick={() => {
              if (canSelect) {
                onToggle();
              }
            }}
            disabled={interactionsDisabled || !canSelect}
            className={cn(
              styles.foodSelectButton,
              selected && styles.foodSelectButtonChecked,
              (!canSelect || interactionsDisabled) &&
                styles.foodSelectButtonDisabled,
            )}
          >
            {selected ? (
              <Check size={12} stroke="#FFFFFF" strokeWidth={3} />
            ) : null}
          </button>
          <div className={styles.foodNameBlock}>
            <h4 className={styles.foodName}>{food.name}</h4>
            <div className={styles.foodMeta}>
              <span className={styles.foodUnit}>{food.unit}</span>
              <span className={styles.foodCategory}>{food.category}</span>
            </div>
          </div>
          <div className={styles.foodStockText}>
            {" "}
            Stock:{" "}
            <strong className={styles.foodStockValue}>{food.stock}</strong>
          </div>
        </div>
        {selected ? (
          <div className={styles.foodQtyControls}>
            <button
              onClick={() => onChangeQty(-1)}
              disabled={interactionsDisabled}
              className={cn(
                styles.quantityButton,
                styles.foodQuantityButton,
                canDecreaseFood
                  ? styles.quantityButtonEnabled
                  : styles.quantityButtonDisabled,
              )}
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <div className={styles.foodQuantityValue}>{qty}</div>
            <button
              onClick={() => onChangeQty(1)}
              disabled={
                interactionsDisabled ||
                qty >= MAX_INDIVIDUAL ||
                qty >= food.stock
              }
              className={cn(
                styles.quantityButton,
                styles.foodQuantityButton,
                canIncreaseFood
                  ? styles.quantityButtonEnabled
                  : styles.quantityButtonDisabled,
              )}
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FoodPackagesCatalogSection({
  model,
}: {
  model: FoodPackagesPageModel;
}) {
  const {
    availableItems,
    categories,
    category,
    displayPackages,
    errorMsg,
    foodBank,
    foodSel,
    interactionsDisabled,
    page,
    pagedFoods,
    pkgQty,
    recentUserApplications,
    remaining,
    remainingPackageSlots,
    totalFoods,
    totalPages,
    totalPkgs,
    weeklyCollected,
    atFoodLimit,
    changeCategory,
    changeFoodQty,
    changePkgQty,
    goToPage,
    toggleFood,
  } = model;

  if (!foodBank) {
    return null;
  }

  // 套餐申请与单品选择共用同一个页面,但各自使用独立的每周限额,
  // 两个区块均从同一个 page-model 快照读取数据。
  return (
    <>
      <div className={styles.hero}>
        <PublicSectionIntro
          title="Apply for food support"
          titleAs="h1"
          size="hero"
          className={styles.heroIntro}
        />
        <div className={styles.keyPoints}>
          {[
            `Up to ${WEEKLY_COLLECTION_LIMIT} packages per week`,
            `Up to ${MAX_INDIVIDUAL} individual items weekly`,
          ].map((text) => (
            <div key={text} className={styles.keyPoint}>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <div className={styles.tabButtons}>
          <ActionButton
            className={styles.tabBtn}
            onClick={() => scrollToId("section-packages")}
          >
            Food Packages
          </ActionButton>
          <ActionButton
            className={styles.tabBtn}
            onClick={() => scrollToId("section-items")}
          >
            Individual Food Items
          </ActionButton>
        </div>
      </div>

      <div className={styles.infoCard}>
        <div>
          <h3 className={styles.fbName}>{foodBank.name}</h3>
          <p className={styles.fbAddr}>{foodBank.address}</p>
        </div>
        <div className={styles.remainingBadge}>
          <div className={styles.remainingNum}>{remaining}</div>
          <div className={styles.remainingLabel}>Remaining</div>
        </div>
      </div>

      <PublicBanner
        tone="neutral"
        className={styles.infoBanner}
        message={
          <>
            Maximum <strong>{WEEKLY_COLLECTION_LIMIT} packages</strong> per
            week. This week:{" "}
            <strong className={styles.accentText}>
              {weeklyCollected}/{WEEKLY_COLLECTION_LIMIT}
            </strong>{" "}
            used, with <strong>{remainingPackageSlots}</strong> package
            {remainingPackageSlots === 1 ? "" : "s"} left.
          </>
        }
      />

      <FoodPackagesApplicationStatusSection
        applications={recentUserApplications}
        foodBankName={foodBank.name}
      />

      {errorMsg ? (
        <PublicBanner
          tone="error"
          className={styles.errorBanner}
          message={errorMsg}
          role="alert"
          ariaLive="polite"
        />
      ) : null}

      <div id="section-packages" className={styles.section}>
        <PublicSectionIntro
          title="Food Packages"
          description={
            <>
              Pre-made packages with essential items. You can request up to{" "}
              {remainingPackageSlots} more package{" "}
              {remainingPackageSlots === 1 ? "" : "s"} this week.
            </>
          }
          titleAs="h2"
          size="compact"
          align="left"
          className={styles.sectionIntro}
        />
        <div className={styles.packageGrid}>
          {displayPackages.map((pkg, index) => (
            <PackageCard
              key={pkg.id}
              interactionsDisabled={interactionsDisabled}
              isAtLimit={!(pkgQty[pkg.id] > 0) && totalPkgs >= remainingPackageSlots}
              onChangeQty={(delta) => changePkgQty(pkg.id, delta, pkg.stock)}
              packageItem={pkg}
              pkgQty={pkgQty[pkg.id] || 0}
              totalPkgs={totalPkgs}
              remainingPackageSlots={remainingPackageSlots}
              image={
                pkg.image || DEFAULT_PKG_IMAGES[index % DEFAULT_PKG_IMAGES.length]
              }
            />
          ))}
        </div>
        {displayPackages.length === 0 ? (
          <div className={styles.emptyCard}>
            {" "}
            No food packages are available from the backend for this food bank
            right now.
          </div>
        ) : null}
      </div>

      <div id="section-items" className={styles.section}>
        <div>
          <PublicSectionIntro
            title="Individual Food Items"
            description={
              <>
                Select specific items based on your needs. Maximum{" "}
                {MAX_INDIVIDUAL} different items per week.
              </>
            }
            titleAs="h2"
            size="compact"
            align="left"
            className={styles.sectionIntro}
          />
          <div
            className={`${styles.statusBar} ${atFoodLimit ? styles.statusBarLimit : ""}`}
          >
            <div className={styles.statusLeft}>
              <span>
                <strong className={styles.accentText}>
                  {totalFoods}/{MAX_INDIVIDUAL}
                </strong>{" "}
                items selected
              </span>
              {atFoodLimit ? (
                <span className={styles.limitBadge}>LIMIT REACHED</span>
              ) : null}
            </div>
            {atFoodLimit ? (
              <span className={styles.statusNote}>
                {" "}
                You have reached the weekly limit. Unselect items to choose
                different ones.
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.categoryFilters}>
          {categories.map((currentCategory) => {
            const active = category === currentCategory;

            return (
              <button
                key={currentCategory}
                onClick={() => changeCategory(currentCategory)}
                className={cn(
                  styles.categoryFilter,
                  active && styles.categoryFilterActive,
                )}
              >
                {currentCategory}
              </button>
            );
          })}
        </div>

        <div className={styles.foodList}>
          {pagedFoods.map((food) => {
            const itemKey = String(food.id);

            return (
              <FoodItemCard
                key={food.id}
                atFoodLimit={atFoodLimit}
                food={food}
                interactionsDisabled={interactionsDisabled}
                onChangeQty={(delta) => changeFoodQty(itemKey, delta, food.stock)}
                onToggle={() => toggleFood(itemKey)}
                qty={foodSel[itemKey] || 0}
              />
            );
          })}
        </div>

        {availableItems.length === 0 ? (
          <div className={styles.emptyCard}>
            {" "}
            No individual food items are available from the backend right now.
          </div>
        ) : null}

        {totalPages > 1 ? (
          <PublicPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={goToPage}
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
        ) : null}
      </div>
    </>
  );
}

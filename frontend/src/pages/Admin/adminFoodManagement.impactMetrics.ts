import type { AdminApplicationRecord } from "@/shared/lib/api/applications";
import type { FoodPackageDetailRecord } from "@/shared/lib/api/packages";
import type {
  PublicImpactMetricCard,
  PublicImpactMetricsStatus,
} from "@/shared/lib/usePublicImpactMetrics";
import type { DonationListRow } from "@/shared/types/donations";

type LocalImpactMetricsArgs = {
  donations: DonationListRow[];
  applications: AdminApplicationRecord[];
  scopedPackageDetails: FoodPackageDetailRecord[];
  isLoading: boolean;
  hasError: boolean;
};

type PeriodContext = {
  today: Date;
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  currentYearStart: Date;
  currentYearEnd: Date;
  previousYearStart: Date;
  previousYearEnd: Date;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function shiftMonth(day: Date, offset: number) {
  return new Date(day.getFullYear(), day.getMonth() + offset, 1);
}

function addDays(day: Date, offset: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset);
}

function minDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(
    0,
    Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000),
  );
}

function buildPeriodContext(): PeriodContext {
  const today = startOfDay(new Date());
  // Compare current and previous periods using the same elapsed day count so
  // partial months and years do not make the present look artificially larger.
  const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextStart = shiftMonth(currentStart, 1);
  const previousStart = shiftMonth(currentStart, -1);
  const currentEnd = minDate(addDays(today, 1), nextStart);
  const previousEnd = minDate(
    addDays(previousStart, daysBetween(currentStart, currentEnd)),
    currentStart,
  );
  const currentYearStart = new Date(today.getFullYear(), 0, 1);
  const nextYearStart = new Date(today.getFullYear() + 1, 0, 1);
  const previousYearStart = new Date(today.getFullYear() - 1, 0, 1);
  const currentYearEnd = minDate(addDays(today, 1), nextYearStart);
  const previousYearEnd = addDays(
    previousYearStart,
    daysBetween(currentYearStart, currentYearEnd),
  );

  return {
    today,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    currentYearStart,
    currentYearEnd,
    previousYearStart,
    previousYearEnd,
  };
}

function parseDateLike(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function inPeriod(target: Date | null, start: Date, end: Date) {
  return target !== null && target.getTime() >= start.getTime() && target.getTime() < end.getTime();
}

function formatInt(value: number) {
  return value.toLocaleString("en-GB");
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return { change: "+0.0%", positive: true };
    }
    return { change: "New", positive: true };
  }

  const delta = ((current - previous) / previous) * 100;
  return {
    change: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`,
    positive: delta >= 0,
  };
}

function formatAbsoluteChange(
  current: number,
  previous: number,
  singularUnit: string,
  pluralUnit?: string,
) {
  const delta = current - previous;
  const unit =
    Math.abs(delta) === 1 ? singularUnit : (pluralUnit ?? `${singularUnit}s`);
  return {
    change: `${delta >= 0 ? "+" : "-"}${Math.abs(delta).toLocaleString("en-GB")} ${unit}`,
    positive: delta >= 0,
  };
}

function pickupDateForApplication(application: AdminApplicationRecord) {
  return (
    parseDateLike(application.redeemed_at) ??
    parseDateLike(application.updated_at) ??
    parseDateLike(application.created_at)
  );
}

function buildPackageRecipeUnits(scopedPackageDetails: FoodPackageDetailRecord[]) {
  return new Map(
    scopedPackageDetails.map((detail) => [
      detail.id,
      detail.package_items.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0,
      ),
    ]),
  );
}

function applicationFoodUnits(
  application: AdminApplicationRecord,
  packageRecipeUnits: Map<number, number>,
) {
  // Package-based applications store pack counts, so expand them back into
  // underlying item units before comparing them with direct item requests.
  return application.items.reduce((total, item) => {
    const quantity = Number(item.quantity || 0);
    if (item.package_id != null) {
      return total + (packageRecipeUnits.get(item.package_id) ?? 0) * quantity;
    }
    if (item.inventory_item_id != null) {
      return total + quantity;
    }
    return total;
  }, 0);
}

function goodsDonationUnits(donation: DonationListRow) {
  return (donation.items ?? []).reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );
}

export function buildLocalAdminImpactMetrics({
  donations,
  applications,
  scopedPackageDetails,
  isLoading,
  hasError,
}: LocalImpactMetricsArgs): {
  impactMetrics: PublicImpactMetricCard[];
  status: PublicImpactMetricsStatus;
} {
  const period = buildPeriodContext();
  const packageRecipeUnits = buildPackageRecipeUnits(scopedPackageDetails);
  const activeApplications = applications.filter(
    (application) => !application.deleted_at,
  );
  const goodsDonations = donations.filter(
    (donation) => donation.donation_type === "goods",
  );

  let allTimeFoodUnitsDistributed = 0;
  let allTimeFoodUnitsBeforeCurrentPeriod = 0;
  let currentCompletedPickups = 0;
  let previousCompletedPickups = 0;

  const allTimeFamilies = new Set<string>();
  const allTimeFamiliesBeforeCurrentPeriod = new Set<string>();

  for (const application of activeApplications) {
    const createdAt = parseDateLike(application.created_at);
    const units = applicationFoodUnits(application, packageRecipeUnits);
    allTimeFoodUnitsDistributed += units;

    if (createdAt && createdAt.getTime() < period.currentStart.getTime()) {
      allTimeFoodUnitsBeforeCurrentPeriod += units;
      allTimeFamiliesBeforeCurrentPeriod.add(application.user_id);
    }

    allTimeFamilies.add(application.user_id);

    if (
      application.status === "collected" &&
      inPeriod(pickupDateForApplication(application), period.currentStart, period.currentEnd)
    ) {
      currentCompletedPickups += 1;
    }
    if (
      application.status === "collected" &&
      inPeriod(
        pickupDateForApplication(application),
        period.previousStart,
        period.previousEnd,
      )
    ) {
      previousCompletedPickups += 1;
    }
  }

  let currentYearGoodsUnits = 0;
  let previousYearGoodsUnits = 0;
  for (const donation of goodsDonations) {
    if (donation.status !== "received") continue;
    const donationDate = parseDateLike(donation.pickup_date ?? donation.created_at);
    const units = goodsDonationUnits(donation);

    if (inPeriod(donationDate, period.currentYearStart, period.currentYearEnd)) {
      currentYearGoodsUnits += units;
    }
    if (inPeriod(donationDate, period.previousYearStart, period.previousYearEnd)) {
      previousYearGoodsUnits += units;
    }
  }

  const foodUnitsChange = formatPercentChange(
    allTimeFoodUnitsDistributed,
    allTimeFoodUnitsBeforeCurrentPeriod,
  );
  const familiesChange = formatAbsoluteChange(
    allTimeFamilies.size,
    allTimeFamiliesBeforeCurrentPeriod.size,
    "family",
    "families",
  );
  const pickupsChange = formatAbsoluteChange(
    currentCompletedPickups,
    previousCompletedPickups,
    "pickup",
    "pickups",
  );
  const goodsUnitsChange = formatPercentChange(
    currentYearGoodsUnits,
    previousYearGoodsUnits,
  );

  return {
    impactMetrics: [
      {
        change: foodUnitsChange.change,
        positive: foodUnitsChange.positive,
        value: formatInt(allTimeFoodUnitsDistributed),
        label: "Food Units Distributed",
        note: "All Time",
      },
      {
        change: familiesChange.change,
        positive: familiesChange.positive,
        value: formatInt(allTimeFamilies.size),
        label: "Families Supported",
        note: "All Time",
      },
      {
        change: pickupsChange.change,
        positive: pickupsChange.positive,
        value: formatInt(currentCompletedPickups),
        label: "Completed Food Pickups",
        note: "This Month",
      },
      {
        change: goodsUnitsChange.change,
        positive: goodsUnitsChange.positive,
        value: formatInt(currentYearGoodsUnits),
        label: "Goods Donation Units",
        note: "This Year",
      },
    ],
    status: hasError
      ? "error"
      : isLoading
        ? "loading"
        : "ready",
  };
}

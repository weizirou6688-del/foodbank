import { cn } from "@/shared/lib/cn";
import {
  ClipboardPenLine,
  HeartHandshake,
  Search,
} from "lucide-react";
import type {
  PublicImpactMetricCard,
  PublicImpactMetricsStatus,
} from "@/shared/lib/usePublicImpactMetrics";
import { Check, ShieldCheck, TrendArrow } from "@/shared/ui/InlineIcons";
import {
  ActionButton,
  PublicBanner,
  PublicSectionIntro,
} from "@/shared/ui/PublicPagePatterns";
import styles from "./Home.module.css";

const gbp = "\u00A3";
const workflowSteps = [
  {
    number: "01",
    title: "Search by postcode",
    description:
      "Enter a postcode to find food banks within 5 km. Results include the platform's own list and nearby matches from public food bank listings.",
    icon: Search,
  },
  {
    number: "02",
    title: "Apply or donate",
    description:
      "Submit a food package application, or send a cash or goods donation. Each request goes to the food bank you select.",
    icon: ClipboardPenLine,
  },
  {
    number: "03",
    title: "Local team follows up",
    description:
      "The food bank's admin reviews your request and confirms collection, redemption, or that stock has been received.",
    icon: HeartHandshake,
  },
] as const;

const goodsCategories = [
  {
    title: "Non-Perishable Food",
    items: [
      "Tinned vegetables & fruit",
      "Rice, pasta & cereals",
      "Tinned meat & fish",
      "UHT milk & plant-based drinks",
      "Cooking oil & sauces",
      "Tea, coffee & long-life juice",
    ],
  },
  {
    title: "Hygiene Essentials",
    items: [
      "Shampoo & conditioner",
      "Soap & body wash",
      "Toothpaste & toothbrushes",
      "Deodorant",
      "Sanitary pads & tampons",
      "Shaving foam & razors",
    ],
  },
  {
    title: "Baby & Child Care",
    items: [
      "Baby formula & baby food",
      "Nappies & wet wipes",
      "Children's snacks & cereals",
      "Baby toiletries",
      "Children's books & toys",
    ],
  },
  {
    title: "Household Items",
    items: [
      "Toilet roll & kitchen roll",
      "Laundry detergent",
      "Surface cleaner & disinfectant",
      "Dishwashing liquid",
      "Bin bags",
    ],
  },
] as const;

const goodsBannerBenefits = [
  "Search for a nearby food bank",
  "Send donation details to the selected team",
  "Arrange collection or drop-off locally",
  "Keep stock records aligned across the network",
] as const;

const uniqueCards = [
  {
    title: "Pre-made packages",
    description:
      "Packages bundle non-perishable food and household basics. Each package consumes specific lots, and the application page shows live availability.",
    image: "/home-gallery/photo-1701914446310-8b63a547ab37",
  },
  {
    title: "Lot tracking",
    description:
      "Inventory is managed by lot with expiry dates. The dashboard surfaces lots expiring within 30 days so admins can move them out in time.",
    image: "/home-gallery/photo-1603418735094-800d47a56ea1",
  },
  {
    title: "Per-bank scope",
    description:
      "Each food bank has its own inventory, packages, and admin scope. Platform admins see the full network; local admins see only their own bank.",
    image: "/home-gallery/photo-1588822534638-028d5ddc07ac",
  },
  {
    title: "Supermarket workspace",
    description:
      "Supermarket partners log into a separate workspace to file pending donations against current low-stock items.",
    image: "/home-gallery/photo-1758599668178-d9716bbda9d5",
  },
] as const;

type HomeDonationTier = {
  amount: string;
  description: string;
  cta: string;
  href: string;
  features: string[];
  featured?: boolean;
};
const donationTiers: HomeDonationTier[] = [
  {
    amount: `${gbp}5`,
    description: "Roughly the cost of a single hygiene or household item on the application page.",
    cta: `Give ${gbp}5 Monthly`,
    href: "/donate/cash?type=monthly&amount=5#donate-form",
    features: [
      "Email receipt with payment reference",
      "Subscription reference for monthly billing",
      "Notification routed to your chosen food bank",
    ],
  },
  {
    amount: `${gbp}15`,
    description: "Approximately the cost of one pre-made package on the application page.",
    cta: `Give ${gbp}15 Monthly`,
    href: "/donate/cash?type=monthly&amount=15#donate-form",
    features: [
      "Email receipt with payment reference",
      "Subscription reference for monthly billing",
      "Counts towards public impact totals on home",
      "Notification routed to your chosen food bank",
    ],
    featured: true,
  },
  {
    amount: `${gbp}30`,
    description:
      "Covers a full package plus a few individual items chosen from the inventory list.",
    cta: `Give ${gbp}30 Monthly`,
    href: "/donate/cash?type=monthly&amount=30#donate-form",
    features: [
      "Email receipt with payment reference",
      "Subscription reference for monthly billing",
      "Counts towards public impact totals on home",
      "Notification routed to your chosen food bank",
    ],
  },
] as const;

const trustItems = [
  "Payment reference issued",
  "Email confirmation",
  "Cancel any time",
] as const;
type HomeNavigationProps = { goTo: (path: string) => void };
type HomeScrollProps = { goToSection: (id: string) => void };
type HomeHeroProps = HomeNavigationProps & HomeScrollProps;
type HomeImpactSectionProps = {
  impactMetrics: PublicImpactMetricCard[];
  status: PublicImpactMetricsStatus;
};
const impactLoadingCardCount = 4;

function BannerCheckIcon() {
  return (
    <span className={styles.bannerCheckWrap}>
      <Check className={styles.bannerCheckIcon} size={16} strokeWidth={2} />
    </span>
  );
}
function StepCard({
  number,
  title,
  description,
  icon: Icon,
}: (typeof workflowSteps)[number]) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepIconWrap}>
        <div className={styles.stepIconShell}>
          <div className={styles.stepIconCircle}>
            <Icon className={styles.stepIcon} aria-hidden="true" />
          </div>
          <div className={styles.stepNumberBadge}>
            <span className={styles.stepNumber}>{number}</span>
          </div>
        </div>
      </div>
      <h3 className={styles.stepTitle}>{title}</h3>
      <p className={styles.stepDescription}>{description}</p>
    </div>
  );
}
export function HomeHero({
  goTo,
  goToSection,
}: HomeHeroProps) {
  const actions = [
    {
      label: "Find a Food Bank",
      onClick: () => goTo("/find-foodbank"),
      tone: "primary" as const,
    },
    {
      label: "Donate Goods",
      onClick: () => goToSection("donate-goods"),
      tone: "outline" as const,
    },
    {
      label: "Donate Cash",
      onClick: () => goToSection("donate-cash"),
      tone: "outline" as const,
    },
  ];
  return (
    <div className={styles.heroSection}>
      <div className={cn(styles.pageSection, styles.heroInner)}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <PublicSectionIntro
              title="ABC Community Food Bank"
              description="Search nearby food banks by postcode, request food packages online, or submit cash and goods donations. Local administrators manage stock and applications from a shared workspace."
              titleAs="h1"
              size="hero"
              align="left"
              className={styles.heroIntro}
            >
              <div className={styles.actions}>
                {actions.map((action, index) => (
                  <ActionButton
                    key={action.label}
                    onClick={action.onClick}
                    tone={action.tone}
                    className={cn(
                      styles.heroActionButton,
                      index === 0 && styles.heroActionWide,
                    )}
                  >
                    {action.label}
                  </ActionButton>
                ))}
              </div>
            </PublicSectionIntro>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroImageCard}>
              <div className={styles.heroImageWrap}>
                <img
                  src="/home-gallery/photo-1710092784814-4a6f158913b8"
                  alt="Food bank operations"
                  className={styles.heroImage}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export function HomeImpactSection({
  impactMetrics,
  status,
}: HomeImpactSectionProps) {
  const hasImpactMetrics = impactMetrics.length > 0;
  const isLoadingWithoutMetrics = status === "loading" && !hasImpactMetrics;
  const isUnavailable = status === "error" && !hasImpactMetrics;
  // 在刷新和短暂失败期间保留最近一次成功的总计数据,
  // 避免首页回退到空状态。
  const footnote =
    status === "error"
      ? hasImpactMetrics
        ? "Showing the most recent live totals while the next refresh is retried."
        : "Live reporting is temporarily unavailable."
      : status === "loading"
        ? hasImpactMetrics
          ? "Refreshing live totals."
          : "Loading live totals."
        : "Uses current reporting when available and refreshes automatically.";

  return (
    <div id="impact" className={styles.impactSection}>
      <div className={cn(styles.pageSection, styles.impactInner)}>
        <PublicSectionIntro
          title="Community Impact"
          className={cn(styles.sectionHeading, styles.sectionHeadingTitleOnly)}
          titleClassName={styles.sectionHeadingTitleOnlyTitle}
        />
        <div className={styles.impactGrid}>
          {isLoadingWithoutMetrics
            ? Array.from({ length: impactLoadingCardCount }, (_, index) => (
                <div
                  key={`impact-loading-${index}`}
                  className={cn(styles.impactCard, styles.impactCardLoading)}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      styles.impactSkeleton,
                      styles.impactSkeletonTrend,
                    )}
                  />
                  <span
                    className={cn(
                      styles.impactSkeleton,
                      styles.impactSkeletonValue,
                    )}
                  />
                  <span
                    className={cn(
                      styles.impactSkeleton,
                      styles.impactSkeletonLabel,
                    )}
                  />
                  <span
                    className={cn(
                      styles.impactSkeleton,
                      styles.impactSkeletonNote,
                    )}
                  />
                </div>
              ))
            : hasImpactMetrics
              ? impactMetrics.map((metric) => (
                  <div key={metric.label} className={styles.impactCard}>
                    <div
                      className={cn(
                        styles.impactTrend,
                        metric.positive === false
                          ? styles.impactTrendNegative
                          : styles.impactTrendPositive,
                      )}
                    >
                      <TrendArrow
                        positive={metric.positive}
                        className={styles.trendIcon}
                      />
                      {metric.change}
                    </div>
                    <div className={styles.impactValue}>{metric.value}</div>
                    <div className={styles.impactLabel}>{metric.label}</div>
                    <div className={styles.impactNote}>{metric.note}</div>
                  </div>
                ))
              : (
                <div className={cn(styles.impactCard, styles.impactStateCard)}>
                  <div className={styles.impactLabel}>
                    Live totals unavailable
                  </div>
                  <div className={styles.impactNote}>
                    We could not load the latest network snapshot right now.
                  </div>
                  {isUnavailable ? (
                    <div className={styles.impactFootnoteInline}>
                      Please retry in a moment.
                    </div>
                  ) : null}
                </div>
              )}
        </div>
        <div className={styles.impactFootnote}>{footnote}</div>
      </div>
    </div>
  );
}
export function HomeWorkflowSection() {
  return (
    <div id="how-it-works" className={styles.workflowSection}>
      <div className={cn(styles.pageSection, styles.workflowInner)}>
        <PublicSectionIntro
          title="How it works"
          className={cn(styles.sectionHeading, styles.sectionHeadingTitleOnly)}
          titleClassName={styles.sectionHeadingTitleOnlyTitle}
        />
        <div className={styles.workflowWrap}>
          <div className={styles.workflowLine}>
            <div className={styles.workflowLineGlow} />
          </div>
          <div className={styles.workflowGrid}>
            {workflowSteps.map((step) => (
              <StepCard key={step.number} {...step} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export function HomeAboutSection() {
  return (
    <div id="about" className={styles.aboutSection}>
      <div className={cn(styles.pageSection, styles.aboutInner)}>
        <PublicSectionIntro
          title="What the platform handles"
          className={cn(styles.sectionHeading, styles.sectionHeadingTitleOnly)}
          titleClassName={styles.sectionHeadingTitleOnlyTitle}
        />
        <div className={styles.aboutGrid}>
          {uniqueCards.map((card) => (
            <div key={card.title} className={styles.aboutCard}>
              <div className={styles.aboutImageCard}>
                <div className={styles.aboutImageWrap}>
                  <img
                    src={card.image}
                    alt={card.title}
                    className={styles.aboutImage}
                  />
                </div>
              </div>
              <h3 className={styles.aboutCardTitle}>{card.title}</h3>
              <p className={styles.aboutCardDescription}>{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export function DonateGoodsSection({
  goTo,
}: HomeNavigationProps) {
  return (
    <div id="donate-goods" className={styles.goodsSection}>
      <div className={cn(styles.pageSection, styles.goodsInner)}>
        <PublicSectionIntro
          title="Donate Goods"
          className={cn(styles.sectionHeading, styles.sectionHeadingTitleOnly)}
          titleClassName={styles.sectionHeadingTitleOnlyTitle}
        />
        <div className={styles.goodsGrid}>
          {goodsCategories.map((category) => (
            <div key={category.title} className={styles.goodsCard}>
              <h3 className={styles.goodsCardTitle}>{category.title}</h3>
              <ul className={styles.goodsList}>
                {category.items.map((item) => (
                  <li key={item} className={styles.goodsListItem}>
                    <span className={styles.goodsListIcon} aria-hidden="true">
                      <Check
                        className={styles.checkIcon}
                        size={16}
                        strokeWidth={2}
                      />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <PublicBanner
          tone="warning"
          split
          className={styles.goodsBanner}
          title="Donate Through a Local Food Bank"
          actions={
            <ActionButton
              onClick={() => goTo("/donate/goods")}
              className={styles.goodsBannerButton}
            >
              Open Donation Form
            </ActionButton>
          }
        >
          <div className={styles.goodsBenefitsGrid}>
            {goodsBannerBenefits.map((benefit) => (
              <div key={benefit} className={styles.goodsBenefit}>
                <BannerCheckIcon />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </PublicBanner>
      </div>
    </div>
  );
}
export function DonateCashSection({
  goTo,
}: HomeNavigationProps) {
  return (
    <div id="donate-cash" className={styles.cashSection}>
      <div className={cn(styles.pageSection, styles.cashInner)}>
        <PublicSectionIntro
          title="Cash donation tiers"
          className={cn(styles.sectionHeading, styles.sectionHeadingTitleOnly)}
          titleClassName={styles.sectionHeadingTitleOnlyTitle}
        />
        <div className={styles.tierGrid}>
          {donationTiers.map((tier) => (
            <div
              key={tier.amount}
              className={cn(
                styles.tierCard,
                tier.featured && styles.tierCardFeatured,
              )}
            >
              {tier.featured ? (
                <div className={styles.tierBadgeWrap}>
                  <span className={styles.tierBadge}> Most Popular</span>
                </div>
              ) : null}
              <div className={styles.tierAmount}>
                {tier.amount}
                <span className={styles.tierPeriod}>/ month</span>
              </div>
              <div className={styles.tierDescription}>{tier.description}</div>
              <ActionButton
                onClick={() => goTo(tier.href)}
                tone={tier.featured ? "primary" : "outline"}
                className={styles.tierButton}
                fullWidth
              >
                {tier.cta}
              </ActionButton>
              <ul className={styles.tierFeatures}>
                {tier.features.map((feature) => (
                  <li key={feature} className={styles.tierFeature}>
                    <span className={styles.tierFeatureIcon} aria-hidden="true">
                      <Check
                        className={styles.checkIcon}
                        size={16}
                        strokeWidth={2}
                      />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.oneTimeCard}>
          <div className={styles.oneTimeRow}>
            <div className={styles.oneTimeContent}>
              <p className={styles.oneTimeTitle}>Prefer a one-off donation?</p>
              <p className={styles.oneTimeDescription}>
                Use the same form to make a single contribution of any amount.
              </p>
            </div>
            <ActionButton
              onClick={() =>
                goTo("/donate/cash?type=onetime#donate-form")
              }
              tone="dark"
              className={styles.oneTimeButton}
            >
              One-Time Donation
            </ActionButton>
          </div>
        </div>
        <div className={styles.trustRow}>
          {trustItems.map((item) => (
            <div key={item} className={styles.trustItem}>
              <ShieldCheck className={styles.shieldIcon} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


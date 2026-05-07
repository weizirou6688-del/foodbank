import { scrollToId } from "@/shared/lib/scroll";
import { Check, X } from "@/shared/ui/InlineIcons";
import { ImageWithFallback } from "@/shared/ui/ImageWithFallback";
import {
  ActionButton,
  PublicPageSection,
  PublicSectionIntro,
} from "@/shared/ui/PublicPagePatterns";
import styles from "./DonateGoods.module.css";

type DonateGoodsFeatureCardContent = {
  title: string;
  description: string;
  image?: string;
};

const HERO_BENEFITS = [
  "Search nearby food banks by postcode",
  "Submit a request to the food bank you choose",
  "Drop-off or collection is arranged with the local team",
];

const STEP_FEATURES: DonateGoodsFeatureCardContent[] = [
  {
    title: "1. Choose a food bank",
    description: "Search by postcode to see nearby food banks within 5 km.",
  },
  {
    title: "2. List your items",
    description: "Describe what you'd like to donate, the condition, the quantity, and a preferred date.",
  },
  {
    title: "3. Local team replies",
    description:
      "The selected food bank's admin reviews the request and contacts you to arrange the rest.",
  },
  {
    title: "4. Drop-off or collection",
    description: "Hand over the donation. The team marks it as received and the items become available stock.",
  },
];

const FEATURE_STORIES: DonateGoodsFeatureCardContent[] = [
  {
    title: "Routed to the chosen team",
    description:
      "Each request is stored as a pending donation against the chosen food bank. Their admin sees it in the workspace and confirms the next step.",
    image:
      "https://images.unsplash.com/photo-1765744893064-dce3184289ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBib3hlcyUyMG9yZ2FuaXplZHxlbnwxfHx8fDE3NzQ5MzU0OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    title: "Recorded as inventory",
    description:
      "Confirmed donations are added as inventory lots with their expiry date and become available for package builds and individual item selection on the application page.",
    image:
      "https://images.unsplash.com/photo-1617080090911-91409e3496ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBzdXBwb3J0JTIwaGFuZHN8ZW58MXx8fHwxNzc0OTM1NDk1fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

const ACCEPTED_ITEMS = [
  {
    category: "Non-Perishable Food",
    items: [
      "Canned proteins: tuna, chicken, salmon, corned beef, spam",
      "Canned vegetables: tomatoes, carrots, peas, sweetcorn, mixed vegetables",
      "Canned fruit: peaches, pears, pineapple, fruit cocktail in juice",
      "Pantry staples: pasta, rice, noodles, pasta sauce, cooking sauce",
      "Breakfast foods: cereal, oatmeal, porridge oats, granola bars",
    ],
  },
  {
    category: "Personal Care & Hygiene",
    items: [
      "Toiletries: shampoo, conditioner, body wash, hand soap, deodorant",
      "Oral care: toothbrushes, toothpaste",
      "Shaving: razors, shaving foam or gel",
      "Feminine hygiene: sanitary pads, tampons",
      "Baby care: nappies, baby wipes, baby food when unopened",
    ],
  },
  {
    category: "Household & Cleaning",
    items: [
      "Cleaning supplies: washing powder, washing-up liquid, household cleaner",
      "Kitchen essentials: dish soap, sponges, bin bags",
      "Laundry items: fabric softener, stain remover, laundry detergent",
      "Paper products: toilet paper, tissues, paper towels",
      "Air care: air fresheners, disinfectant spray",
    ],
  },
];

const REJECTED_ITEMS = [
  "Homemade foods",
  "Opened or damaged packages",
  "Dented or bulging cans",
  "Expired items",
  "Perishable foods requiring refrigeration",
  "Glass jars where possible",
];

function FeatureCard({
  title,
  description,
  image,
}: DonateGoodsFeatureCardContent) {
  if (image) {
    return (
      <article className={styles.featureImageCard}>
        <ImageWithFallback
          src={image}
          alt={title}
          className={styles.featureImage}
        />
        <div className={styles.featureImageOverlay}>
          <div className={styles.featureImageContent}>
            <h3 className={styles.featureImageTitle}>{title}</h3>
            <p className={styles.featureImageText}>{description}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={styles.featureCard}>
      <h3 className={styles.featureCardTitle}>{title}</h3>
      <p className={styles.featureCardText}>{description}</p>
    </article>
  );
}

export function DonateGoodsHeroSection() {
  // hero 区 CTA 按钮直接跳转到实时捐赠流程,让捐赠者在视野内保留背景内容,
  // 而不是跳转到一个孤立的页面。
  return (
    <PublicPageSection id="home" width="page" innerClassName={styles.heroInner}>
      <PublicSectionIntro
        title="Donate goods to a local food bank"
        description="Search for a food bank by postcode, then submit a request listing the items, quantity, and a preferred drop-off or collection date."
        descriptionExtraLine="Donations are recorded as pending and confirmed by the local admin before stock is updated."
        titleAs="h1"
        size="hero"
        className={styles.heroIntro}
      >
        <div className={styles.heroBenefits}>
          {HERO_BENEFITS.map((benefit) => (
            <div key={benefit} className={styles.heroBenefit}>
              <Check className={styles.checkIcon} strokeWidth={3} />
              <span className={styles.heroBenefitText}>{benefit}</span>
            </div>
          ))}
        </div>
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1738618141234-1ee52c6475a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHNoZWx2ZXMlMjBjYW5uZWQlMjBnb29kc3xlbnwxfHx8fDE3NzQ5Mzc1MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Food bank shelves with donations"
          className={styles.heroImage}
        />
        <ActionButton
          onClick={() => scrollToId("donate")}
          className={styles.heroCta}
        >
          Donate Goods
        </ActionButton>
      </PublicSectionIntro>
    </PublicPageSection>
  );
}

export function DonateGoodsHowItWorksSection() {
  return (
    <PublicPageSection tone="muted" width="page">
      <PublicSectionIntro
        title="How it works"
        className={styles.sectionHeader}
      />
      <div className={styles.featureGrid}>
        {STEP_FEATURES.map((feature) => (
          <FeatureCard
            key={feature.title}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
      <div className={styles.featureStoryGrid}>
        {FEATURE_STORIES.map((story) => (
          <FeatureCard
            key={story.title}
            title={story.title}
            description={story.description}
            image={story.image}
          />
        ))}
      </div>
    </PublicPageSection>
  );
}

export function DonateGoodsAcceptedItemsSection() {
  // 保持可接受与不可接受物品的说明与捐赠者流程一致,
  // 确保落地页与提交表单之间不会产生矛盾。
  return (
    <PublicPageSection tone="muted" width="page">
      <PublicSectionIntro
        title="What we accept"
        description="All items must be unopened, in original packaging, and within their best-before dates"
        className={styles.sectionHeader}
      />
      <div className={styles.acceptedGrid}>
        {ACCEPTED_ITEMS.map((group) => (
          <article key={group.category} className={styles.acceptedCard}>
            <h3 className={styles.acceptedCardTitle}>{group.category}</h3>
            <ul className={styles.acceptedList}>
              {group.items.map((item) => (
                <li key={item} className={styles.acceptedListItem}>
                  <Check className={styles.acceptedListIcon} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className={styles.noticeCardPrimary}>
        <Check className={styles.noticeIconSuccess} />
        <div>
          <p className={styles.noticeText}>
            <strong>Please note:</strong> All items must be unopened, in their
            original packaging, and within their best-before or use-by dates.
          </p>
        </div>
      </div>
      <div className={styles.noticeCardNeutral}>
        <X className={styles.noticeIconDanger} />
        <div>
          <p className={styles.noticeTitle}>
            <strong>We cannot accept:</strong>
          </p>
          <ul className={styles.rejectedList}>
            {REJECTED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicPageSection>
  );
}

export { DonateGoodsFlowSection } from "./DonateGoods.flow";

import { cn } from "@/shared/lib/cn";
import PublicPageShell from "@/shared/ui/PublicPageShell";
import shellStyles from "@/shared/ui/PublicPageShell.module.css";
import {
  DonateGoodsAcceptedItemsSection,
  DonateGoodsFlowSection,
  DonateGoodsHeroSection,
  DonateGoodsHowItWorksSection,
} from "./DonateGoods.sections";
import { useDonateGoodsPageModel } from "./donateGoods.pageModel";
import styles from "./DonateGoods.module.css";

export default function DonateGoods() {
  const model = useDonateGoodsPageModel();

  return (
    <PublicPageShell>
      <div className={cn(shellStyles.pageRoot, styles.page)}>
        <DonateGoodsHeroSection />
        <DonateGoodsHowItWorksSection />
        <DonateGoodsAcceptedItemsSection />
        <DonateGoodsFlowSection model={model} />
      </div>
    </PublicPageShell>
  );
}

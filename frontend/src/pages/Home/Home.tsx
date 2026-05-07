import PublicPageShell from "@/shared/ui/PublicPageShell";
import {
  DonateCashSection,
  DonateGoodsSection,
  HomeAboutSection,
  HomeHero,
  HomeImpactSection,
  HomeWorkflowSection,
} from "./Home.sections";
import { useHomePage } from "./home.pageModel";

export default function Home() {
  const { impactMetrics, impactStatus, goTo, goToSection } = useHomePage();
  return (
    <PublicPageShell>
      <HomeHero goTo={goTo} goToSection={goToSection} />
      <HomeImpactSection
        impactMetrics={impactMetrics}
        status={impactStatus}
      />
      <HomeWorkflowSection />
      <HomeAboutSection />
      <DonateGoodsSection goTo={goTo} />
      <DonateCashSection goTo={goTo} />
    </PublicPageShell>
  );
}


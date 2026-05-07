import PublicPageShell from "@/shared/ui/PublicPageShell";
import { useFoodPackagesPageModel } from "./foodPackages.pageModel";
import {
  FoodPackagesEmptyState,
  FoodPackagesReadyState,
} from "./FoodPackages.sections";
import styles from "./FoodPackages.module.css";
export default function FoodPackages() {
  const model = useFoodPackagesPageModel();
  const { foodBank, isBootstrapping } = model;
  // 将初始引导阶段与"真正没有关联食物银行"的状态区分开来,
  // 使空状态文案能准确反映当前是加载中还是确实没有数据。
  if (isBootstrapping && !foodBank) {
    return (
      <PublicPageShell>
        <FoodPackagesEmptyState
          title="Loading Food Support Options"
          message="Connecting this page to the live backend and database."
        />
      </PublicPageShell>
    );
  }
  if (!foodBank) {
    return (
      <PublicPageShell>
        <FoodPackagesEmptyState
          title="No Connected Food Bank Available"
          message="The backend did not return a food bank for online applications."
        />
      </PublicPageShell>
    );
  }
  return (
    <PublicPageShell mainClassName={styles.pageWrap}>
      <FoodPackagesReadyState model={model} />
    </PublicPageShell>
  );
}

import { type MouseEvent } from "react";
import {
  BriefcaseBusiness,
  Camera,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/app/store/authStore";
import type { RestrictedRole } from "@/features/auth/auth.helpers";
import LoginModal from "@/features/auth/components/LoginModal";
import { useLoginModalController } from "@/features/auth/components/loginModal.model";
import styles from "./PublicSiteFooter.module.css";
type FooterLink = {
  label: string;
  path: string;
  requiredRole?: RestrictedRole;
};
const footerSections: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Community",
    links: [
      { label: "Home", path: "/home" },
      { label: "Get Support", path: "/find-foodbank" },
      { label: "Donate Cash", path: "/donate/cash" },
      { label: "Donate Goods", path: "/donate/goods" },
    ],
  },
  {
    title: "Admin Tools",
    links: [
      {
        label: "Inventory Management",
        path: "/workspace?section=food",
        requiredRole: "admin",
      },
      {
        label: "Data Dashboard",
        path: "/workspace?section=statistics",
        requiredRole: "admin",
      },
    ],
  },
  {
    title: "Partner Access",
    links: [
      {
        label: "Donation Form",
        path: "/workspace?section=restock",
        requiredRole: "supermarket",
      },
    ],
  },
];
const SOCIAL_LINKS = [
  {
    href: "#twitter",
    label: "Twitter",
    icon: Send,
  },
  {
    href: "#linkedin",
    label: "LinkedIn",
    icon: BriefcaseBusiness,
  },
  {
    href: "#instagram",
    label: "Instagram",
    icon: Camera,
  },
];
function SocialIconLink({
  href,
  label,
  icon: Icon,
}: (typeof SOCIAL_LINKS)[number] & { icon: LucideIcon }) {
  return (
    <a href={href} className={styles.socialLink} aria-label={label}>
      <Icon className={styles.socialIcon} aria-hidden="true" />
    </a>
  );
}
export default function PublicSiteFooter() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const loginModal = useLoginModalController({ initialTab: "signin" });
  const handleFooterLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    link: FooterLink,
  ) => {
    event.preventDefault();
    // 受保护的 workspace 链接出现在公开页脚,未登录访客点击后进入登录流程并保留目标重定向
    if (link.requiredRole && !isAuthenticated) {
      loginModal.openSignIn({
        redirectTo: link.path,
        requiredRole: link.requiredRole,
      });
      return;
    }
    navigate(link.path);
  };
  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.topGrid}>
            <div className={styles.brandColumn}>
              <h3 className={styles.brandTitle}>ABC Foodbank</h3>
              <p className={styles.brandDescription}>
                A platform for searching nearby food banks, requesting food
                support online, and submitting cash or goods donations. Used by
                public users, food bank administrators, and supermarket
                partners.
              </p>
              <div className={styles.contactBlock}>
                <div className={styles.sectionTitle}>Contact Office</div>
                <div className={styles.contactText}>
                  Penglais, Aberystwyth SY23 3FL
                </div>
              </div>
              <div className={styles.socialLinks}>
                {SOCIAL_LINKS.map((link) => (
                  <SocialIconLink key={link.label} {...link} />
                ))}
              </div>
            </div>
            {footerSections.map((section) => (
              <div key={section.title} className={styles.linkColumn}>
                <h4 className={styles.linkHeading}>{section.title}</h4>
                <ul className={styles.linkList}>
                  {section.links.map((link) => (
                    <li key={link.path}>
                      <a
                        href={link.path}
                        onClick={(event) => handleFooterLinkClick(event, link)}
                        className={styles.footerLink}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className={styles.bottomBar}>
            <div className={styles.bottomRow}>
              <p className={styles.copyright}>
                Copyright 2026 ABC Foodbank. All rights reserved.
              </p>
              <span className={styles.statusDot} />
            </div>
          </div>
        </div>
      </footer>
      <LoginModal {...loginModal.modalProps} />
    </>
  );
}

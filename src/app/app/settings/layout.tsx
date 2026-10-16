import type { ReactNode } from "react";
import "@/styles/mgmt.css";

/**
 * Settings section layout (M-02…M-05 + audit). The sub-menu itself is
 * rendered by each page's SettingsHead (it sits inside the page head, above
 * the title, exactly as drawn on the screens); this layout only scopes the
 * settings-family styles.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="mgmt mgmt-settings">{children}</div>;
}

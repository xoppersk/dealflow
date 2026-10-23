import { personByIdSafe } from "@/lib/df/api";
import { useDataset } from "./dataset-context";
import type { Activity } from "@/lib/df/types";
import { OwnerAvatar } from "./primitives";

/** ActivityRow (§7): time (mono) + owner + "Type · subject" + detail line.
 *  Overdue tasks: --act-tint row with an --act "N days overdue" label. */
export function ActivityRow({ activity }: { activity: Activity }) {
  const ds = useDataset();
  const owner = personByIdSafe(ds.team, activity.ownerId) ?? {
    id: activity.ownerId, name: "Owner", firstName: "Owner", initials: "??", email: "", role: "Rep",
    openDeals: 0, openValue: 0, openValueLabel: "", avatarBg: "#F1EEE6", avatarColor: "#17201E", online: false,
  };
  const overdue = activity.overdueDays !== undefined;
  return (
    <div className={`ev${overdue ? " overdue" : ""}`}>
      <span className="mono">{activity.timeLabel}</span>
      <OwnerAvatar person={owner} large />
      <span>
        <b>{activity.type}</b> · {activity.subject}
        {activity.detail ? <small>{activity.detail}</small> : null}
        {overdue ? (
          <small className="u-act" style={{ fontWeight: 600 }}>
            {activity.overdueDays} days overdue
          </small>
        ) : null}
      </span>
    </div>
  );
}

/** OfflineQueue banner (§7): ink banner with the queued-change count. */
export function OfflineBanner({ count }: { count: number }) {
  return (
    <div className="banner-ink" role="status">
      <span>
        <b style={{ color: "#fff" }}>You’re offline.</b> {count} changes are saved on this phone and will send when
        you’re back.
      </span>
    </div>
  );
}

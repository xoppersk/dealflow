import { redirect } from "next/navigation";

/** v2 routes live under /app (HANDOVER §3); the root goes to Today. */
export default function RootPage() {
  redirect("/app");
}

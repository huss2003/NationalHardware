import type { Database } from "@/integrations/supabase/types";
type Status = Database["public"]["Enums"]["item_status"];
const labels: Record<Status, string> = {
  available: "Available", sold: "Sold", damaged: "Damaged",
  used_in_production: "Used", returned: "Returned", reserved: "Reserved",
};
export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase status-${status}`}>
      {labels[status]}
    </span>
  );
}

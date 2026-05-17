import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScanInput } from "@/components/erp/ScanInput";
import { PageHeader } from "@/components/erp/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory/scan")({ component: ScanPage });

function ScanPage() {
  const nav = useNavigate();
  const onScan = async (code: string) => {
    const { data } = await supabase.from("item_instances").select("id").eq("id", code).maybeSingle();
    if (!data) { toast.error(`No item with ID ${code}`); return; }
    nav({ to: "/units/$itemId", params: { itemId: data.id } });
  };
  return (
    <>
      <PageHeader title="Scan unit" subtitle="Scan a label or type the ID to view item history" />
      <div className="px-8 pb-8 max-w-2xl"><ScanInput onScan={onScan} /></div>
    </>
  );
}

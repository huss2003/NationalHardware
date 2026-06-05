import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { fmtDateTime } from "@/lib/codes";

export const Route = createFileRoute("/_app/alerts")({ component: Alerts });
function Alerts() {
  const queryClient = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
    staleTime: 30_000,
  });
  const markRead = async (id: string) => {
    await supabase.from("alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
  };
  return (
    <>
      <PageHeader title="Alerts" />
      <div className="px-8 pb-8 space-y-3">
        {rows.map(a => (
          <Card key={a.id} className={`p-4 border-l-4 ${a.severity==="critical"?"border-destructive":a.severity==="warning"?"border-amber-500":"border-primary"}`}>
            <div className="flex justify-between gap-4">
              <div>
                <div className="font-bold uppercase">{a.type}</div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</div>
                <pre className="text-xs mt-1">{JSON.stringify(a.payload, null, 2)}</pre>
              </div>
              {!a.read_at && <Button variant="outline" onClick={() => markRead(a.id)}>Mark read</Button>}
            </div>
          </Card>
        ))}
        {rows.length === 0 && <div className="text-center text-muted-foreground p-10">No alerts</div>}
      </div>
    </>
  );
}

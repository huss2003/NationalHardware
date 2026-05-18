import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ScanInput } from "@/components/erp/ScanInput";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertOctagon, XCircle } from "lucide-react";

export const Route = createFileRoute("/_app/inventory/scan")({ component: ScanPage });

type Result =
  | { kind: "ok"; id: string; product: string; status: string }
  | { kind: "sold"; id: string; product: string }
  | { kind: "unavailable"; id: string; product: string; status: string }
  | { kind: "missing"; code: string };

function ScanPage() {
  const nav = useNavigate();
  const [result, setResult] = useState<Result | null>(null);

  const onScan = async (code: string) => {
    setResult(null);
    const { data } = await supabase
      .from("item_instances")
      .select("id, status, products(name)")
      .eq("id", code)
      .maybeSingle();
    if (!data) {
      setResult({ kind: "missing", code });
      return;
    }
    const productName = (data as any).products?.name ?? "Item";
    if (data.status === "sold") {
      setResult({ kind: "sold", id: data.id, product: productName });
    } else if (data.status !== "available") {
      setResult({ kind: "unavailable", id: data.id, product: productName, status: data.status });
    } else {
      setResult({ kind: "ok", id: data.id, product: productName, status: data.status });
    }
  };

  return (
    <>
      <PageHeader title="Scan unit" subtitle="Scan a label or type the ID to view item history" />
      <div className="px-8 pb-8 max-w-2xl space-y-4">
        <ScanInput onScan={onScan} />

        {result?.kind === "ok" && (
          <div className="p-5 rounded-xl border-2 border-green-500 bg-green-500/10 space-y-3">
            <div className="flex items-center gap-3 text-green-700 dark:text-green-400 font-bold text-lg">
              <CheckCircle2 className="h-6 w-6" /> Available
            </div>
            <div>
              <div className="font-bold text-xl">{result.product}</div>
              <div className="font-mono text-sm text-muted-foreground">{result.id}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => nav({ to: "/units/$itemId", params: { itemId: result.id } })}>
                View history
              </Button>
              <Button variant="secondary" onClick={() => nav({ to: "/sales/new" })}>
                Sell now
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Scan another
              </Button>
            </div>
          </div>
        )}

        {result?.kind === "sold" && (
          <div className="p-5 rounded-xl border-2 border-destructive bg-destructive/10 space-y-3">
            <div className="flex items-center gap-3 text-destructive font-bold text-lg">
              <AlertOctagon className="h-6 w-6" /> Already sold
            </div>
            <div>
              <div className="font-bold text-xl">{result.product}</div>
              <div className="font-mono text-sm text-muted-foreground">{result.id}</div>
              <p className="text-sm text-muted-foreground mt-1">
                This unit was already sold. Open the unit to see the invoice or scan a different label.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => nav({ to: "/units/$itemId", params: { itemId: result.id } })}>
                View history
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Scan another
              </Button>
            </div>
          </div>
        )}

        {result?.kind === "unavailable" && (
          <div className="p-5 rounded-xl border-2 border-amber-500 bg-amber-500/10 space-y-3">
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400 font-bold text-lg">
              <AlertOctagon className="h-6 w-6" /> {result.status.replace(/_/g, " ").toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-xl">{result.product}</div>
              <div className="font-mono text-sm text-muted-foreground">{result.id}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => nav({ to: "/units/$itemId", params: { itemId: result.id } })}>
                View history
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Scan another
              </Button>
            </div>
          </div>
        )}

        {result?.kind === "missing" && (
          <div className="p-5 rounded-xl border-2 border-destructive bg-destructive/10 space-y-3">
            <div className="flex items-center gap-3 text-destructive font-bold text-lg">
              <XCircle className="h-6 w-6" /> Not found
            </div>
            <p>
              No item with ID <span className="font-mono font-bold">{result.code}</span>. Check the label or
              create a purchase to mint new units.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => nav({ to: "/purchases/new" })}>New purchase</Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Scan again
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

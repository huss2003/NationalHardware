import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { seedDemoData } from "@/lib/seed";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Database, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_app/dev")({ component: DevTools });

type Status = "pending" | "ok" | "fail" | "blank";
type Probe = { path: string; status: Status; note?: string };

function DevTools() {
  const user = useAuth((s) => s.user);
  const [seeding, setSeeding] = useState(false);
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [probes, setProbes] = useState<Probe[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const log = await seedDemoData(user?.id ?? "00000000-0000-0000-0000-000000000000");
      setSeedLog((prev) => [...log, ...prev]);
      toast.success("Demo data seeded");
    } catch (e: any) {
      toast.error(e.message ?? "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const runSmoke = async () => {
    setRunning(true);
    // Build the route list — list, new, and detail (sampled from DB).
    const staticPaths = [
      "/dashboard",
      "/inventory",
      "/inventory/scan",
      "/purchases",
      "/purchases/new",
      "/sales",
      "/sales/new",
      "/production",
      "/production/new",
      "/bom",
      "/reports",
      "/employees",
      "/alerts",
      "/settings",
    ];
    const [{ data: pur }, { data: sal }, { data: prod }, { data: units }, { data: prods }] = await Promise.all([
      supabase.from("purchases").select("id").limit(1),
      supabase.from("sales").select("id").limit(1),
      supabase.from("production_orders").select("id").limit(1),
      supabase.from("item_instances").select("id").limit(1),
      supabase.from("products").select("id").limit(1),
    ]);
    const dyn: string[] = [];
    if (pur?.[0]) dyn.push(`/purchases/${pur[0].id}`);
    if (sal?.[0]) dyn.push(`/sales/${sal[0].id}`);
    if (prod?.[0]) dyn.push(`/production/${prod[0].id}`);
    if (units?.[0]) dyn.push(`/units/${units[0].id}`);
    if (prods?.[0]) dyn.push(`/inventory/${prods[0].id}`);

    const list: Probe[] = [...staticPaths, ...dyn].map((p) => ({ path: p, status: "pending" as Status }));
    setProbes(list);

    // Sequentially mount each in a sandbox iframe and check for content.
    for (let i = 0; i < list.length; i++) {
      const probe = list[i];
      const result = await probeRoute(probe.path, containerRef.current!);
      setProbes((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...result } : p)));
    }
    setRunning(false);
  };

  const summary = probes.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<Status, number>,
  );

  return (
    <>
      <PageHeader
        title="Dev tools"
        subtitle="Seed sample data and run a navigation smoke test across every screen"
      />
      <div className="px-8 pb-8 space-y-5">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Database className="h-5 w-5" /> Demo data seeder
          </div>
          <p className="text-sm text-muted-foreground">
            Creates a supplier, customer, demo product (if missing), a purchase with 3 minted units, and a sale of one unit.
            Safe to run multiple times.
          </p>
          <Button onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Seed demo data
          </Button>
          {seedLog.length > 0 && (
            <ul className="text-xs font-mono space-y-1 max-h-40 overflow-auto bg-muted/40 p-3 rounded">
              {seedLog.map((l, i) => (
                <li key={i}>✓ {l}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-lg">
              <PlayCircle className="h-5 w-5" /> Navigation smoke test
            </div>
            <Button onClick={runSmoke} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Run smoke test
            </Button>
          </div>
          {probes.length > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-semibold">✓ {summary.ok ?? 0} ok</span>
              <span className="text-destructive font-semibold">✗ {summary.fail ?? 0} failed</span>
              <span className="text-amber-600 font-semibold">○ {summary.blank ?? 0} blank</span>
              <span className="text-muted-foreground">… {summary.pending ?? 0} pending</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {probes.map((p) => (
              <div key={p.path} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                <code className="font-mono">{p.path}</code>
                <span className="flex items-center gap-1">
                  {p.status === "pending" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {p.status === "ok" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {p.status === "fail" && <XCircle className="h-4 w-4 text-destructive" />}
                  {p.status === "blank" && <XCircle className="h-4 w-4 text-amber-600" />}
                  {p.note && <span className="text-xs text-muted-foreground ml-1">{p.note}</span>}
                </span>
              </div>
            ))}
          </div>
          <div ref={containerRef} className="hidden" />
        </Card>
      </div>
    </>
  );
}

function probeRoute(path: string, host: HTMLElement): Promise<{ status: Status; note?: string }> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = path;
    iframe.style.width = "1024px";
    iframe.style.height = "640px";
    iframe.style.position = "absolute";
    iframe.style.left = "-99999px";
    let settled = false;
    const finish = (status: Status, note?: string) => {
      if (settled) return;
      settled = true;
      try {
        host.removeChild(iframe);
      } catch {}
      resolve({ status, note });
    };
    iframe.onload = () => {
      // Give the SPA a moment to render after navigation.
      setTimeout(() => {
        try {
          const doc = iframe.contentDocument;
          const text = (doc?.body?.innerText ?? "").trim();
          if (!text) return finish("blank", "no visible content");
          if (/this page didn't load|something went wrong|error/i.test(text.slice(0, 200))) {
            return finish("fail", "error boundary");
          }
          finish("ok");
        } catch (e: any) {
          finish("fail", e?.message);
        }
      }, 1200);
    };
    iframe.onerror = () => finish("fail", "iframe error");
    host.appendChild(iframe);
    setTimeout(() => finish("fail", "timeout"), 8000);
  });
}
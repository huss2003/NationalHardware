import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr } from "@/lib/codes";
import { toast } from "sonner";
import { Plus, DoorOpen } from "lucide-react";

export const Route = createFileRoute("/_app/door")({ component: DoorPage });

type Category = "general" | "vypaari";
type DoorType = { id: string; name: string; rate: number; active: boolean };
type DoorOrder = {
  id: string; order_no: string; order_date: string; category: Category;
  customer_name: string; party_door_size: string | null; front_mica: string | null;
  back_mica: string | null; door_taken_size: string | null;
  door_type_id: string | null; door_type_name: string | null;
  rate: number; total: number;
};

function DoorPage() {
  const [tab, setTab] = useState<Category>("general");
  const [doorTypes, setDoorTypes] = useState<DoorType[]>([]);
  const [orders, setOrders] = useState<DoorOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [dt, oo] = await Promise.all([
      supabase.from("door_types").select("*").eq("active", true).order("name"),
      supabase.from("door_orders").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setDoorTypes((dt.data as any) ?? []);
    setOrders((oo.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(
    () => orders.filter((o) => o.category === tab),
    [orders, tab],
  );

  return (
    <>
      <PageHeader
        title="Door"
        subtitle="Record door orders. General accepts a custom rate; Vypaari uses the saved door-type rate."
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Category)}>
          <TabsList className="mb-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="vypaari">Vypaari</TabsTrigger>
          </TabsList>

          {(["general", "vypaari"] as const).map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-5">
              <DoorForm
                category={cat}
                doorTypes={doorTypes}
                nextOrderNoHint={nextOrderNo(orders, cat)}
                onSaved={reload}
              />
              <OrdersTable rows={filtered} loading={loading} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}

function nextOrderNo(orders: DoorOrder[], cat: Category) {
  const prefix = cat === "general" ? "DG" : "DV";
  const max = orders
    .filter((o) => o.category === cat && o.order_no?.startsWith(prefix + "-"))
    .map((o) => parseInt(o.order_no.split("-")[1] ?? "0", 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

function DoorForm({
  category, doorTypes, nextOrderNoHint, onSaved,
}: {
  category: Category;
  doorTypes: DoorType[];
  nextOrderNoHint: string;
  onSaved: () => void;
}) {
  const [orderNo, setOrderNo] = useState(nextOrderNoHint);
  const [customer, setCustomer] = useState("");
  const [partySize, setPartySize] = useState("");
  const [frontMica, setFrontMica] = useState("");
  const [backMica, setBackMica] = useState("");
  const [takenSize, setTakenSize] = useState("");
  const [doorTypeId, setDoorTypeId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [manualRate, setManualRate] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setOrderNo(nextOrderNoHint); }, [nextOrderNoHint]);

  const selectedType = doorTypes.find((d) => d.id === doorTypeId);
  const isVypaari = category === "vypaari";
  const rate = isVypaari ? Number(selectedType?.rate ?? 0) : Number(manualRate || 0);
  const total = rate * (qty || 0);

  const reset = () => {
    setCustomer(""); setPartySize(""); setFrontMica(""); setBackMica("");
    setTakenSize(""); setDoorTypeId(""); setQty(1); setManualRate(0); setNotes("");
  };

  const save = async () => {
    if (!customer.trim()) { toast.error("Customer name is required"); return; }
    if (!doorTypeId) { toast.error("Select a door type"); return; }
    if (isVypaari && !selectedType) { toast.error("Door type rate missing"); return; }
    if (!isVypaari && manualRate <= 0) { toast.error("Enter a price"); return; }
    setBusy(true);
    const { error } = await supabase.from("door_orders").insert({
      order_no: orderNo,
      category,
      customer_name: customer.trim(),
      party_door_size: partySize || null,
      front_mica: frontMica || null,
      back_mica: backMica || null,
      door_taken_size: takenSize || null,
      door_type_id: doorTypeId,
      door_type_name: selectedType?.name ?? null,
      rate,
      total,
      notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Door order saved");
    reset();
    onSaved();
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <DoorOpen className="h-4 w-4" />
        </div>
        <div>
          <div className="font-semibold text-base">
            New {isVypaari ? "Vypaari" : "General"} door order
          </div>
          <div className="text-xs text-muted-foreground">
            {isVypaari
              ? "Rate is auto-filled from the selected door type."
              : "Enter the price manually. Total is calculated automatically."}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Order No.">
          <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input value={new Date().toLocaleDateString()} disabled />
        </Field>
        <Field label="Customer / Name">
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" />
        </Field>

        <Field label="Party Door Size">
          <Input value={partySize} onChange={(e) => setPartySize(e.target.value)} placeholder="e.g. 7x3" />
        </Field>
        <Field label="Front Mica">
          <Input value={frontMica} onChange={(e) => setFrontMica(e.target.value)} />
        </Field>
        <Field label="Back Mica">
          <Input value={backMica} onChange={(e) => setBackMica(e.target.value)} />
        </Field>

        <Field label="Door Taken Size">
          <Input value={takenSize} onChange={(e) => setTakenSize(e.target.value)} placeholder="e.g. 6.8x2.10" />
        </Field>
        <Field label="Door Type">
          <Select value={doorTypeId} onValueChange={setDoorTypeId}>
            <SelectTrigger>
              <SelectValue placeholder={doorTypes.length ? "Select door type" : "Add types in Settings"} />
            </SelectTrigger>
            <SelectContent>
              {doorTypes.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}{isVypaari ? ` — ${inr(Number(d.rate))}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quantity">
          <Input
            type="number" min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
          />
        </Field>

        <Field label={isVypaari ? "Rate (auto)" : "Price (per door)"}>
          <Input
            type="number"
            value={isVypaari ? rate : manualRate}
            disabled={isVypaari}
            onChange={(e) => setManualRate(Number(e.target.value || 0))}
          />
        </Field>
        <Field label="Total">
          <Input value={inr(total)} disabled />
        </Field>
        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
            placeholder="Optional"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={reset}>Reset</Button>
        <Button onClick={save} disabled={busy} className="gap-2">
          <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Save order"}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function OrdersTable({ rows, loading }: { rows: DoorOrder[]; loading: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3 font-semibold">Recent orders</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Order No.</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Door Type</TableHead>
            <TableHead>Taken Size</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right pr-5">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="pl-5 font-medium">{o.order_no}</TableCell>
              <TableCell>{new Date(o.order_date).toLocaleDateString()}</TableCell>
              <TableCell>{o.customer_name}</TableCell>
              <TableCell>{o.door_type_name ?? "—"}</TableCell>
              <TableCell>{o.door_taken_size ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{inr(Number(o.rate))}</TableCell>
              <TableCell className="text-right pr-5 font-semibold tabular-nums">{inr(Number(o.total))}</TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                No door orders yet in this category.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

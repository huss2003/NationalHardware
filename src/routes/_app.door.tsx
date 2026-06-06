import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { inr, fmtDate } from "@/lib/codes";
import { toast } from "sonner";
import { Plus, DoorOpen, Trash2, FileText } from "lucide-react";
import { QuickCreatePartyDialog } from "@/components/erp/QuickCreatePartyDialog";
import { buildDoorOrderPdf, openPdfInNewTab } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_app/door")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
  }),
  component: DoorPage,
});

async function findOrCreateDoorProduct() {
  const { data: existing } = await supabase
    .from("products")
    .select("id,name,gst_rate,unit")
    .eq("prefix", "DOOR")
    .maybeSingle();
  if (existing) return existing as { id: string; name: string; gst_rate: number; unit: string };
  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name: "Door (Custom)", prefix: "DOOR", category: "door" as any,
      unit: "pcs", gst_rate: 18, default_price: 0, active: true,
    })
    .select("id,name,gst_rate,unit")
    .single();
  if (error) throw error;
  return created as { id: string; name: string; gst_rate: number; unit: string };
}

type Category = "general" | "vypaari";
type DoorType = { id: string; name: string; rate: number; active: boolean };
type Customer = { id: string; name: string; phone?: string | null };
type DoorOrder = {
  id: string; order_no: string; order_date: string; category: Category;
  customer_name: string; party_door_size: string | null; front_mica: string | null;
  back_mica: string | null; door_taken_size: string | null;
  door_type_id: string | null; door_type_name: string | null;
  rate: number; total: number;
  notes?: string | null;
};

const DEFAULT_DOOR_TYPE_NAMES = ["F-Hard", "F-Pine", "WF-Pine", "WF-Hard"] as const;
const DOOR_MADE_OPTIONS = ["S.D", "D.D", "J.D", "JDD", "PLY", "WINDOW"] as const;

async function loadShopForPdf() {
  const { data } = await supabase.from("app_settings")
    .select("shop_name, address, gstin").eq("id", true).maybeSingle();
  return (data as any) ?? null;
}

async function openDoorOrderPdf(order: DoorOrder) {
  const [shopRes, itemsRes, custRes] = await Promise.all([
    loadShopForPdf(),
    order.category === "general"
      ? (supabase as any).from("door_order_items").select("*").eq("order_id", order.id)
      : Promise.resolve({ data: null }),
    supabase.from("customers").select("phone,address").eq("name", order.customer_name).maybeSingle(),
  ]);
  const items =
    order.category === "general" && itemsRes?.data?.length
      ? itemsRes.data
      : [{
          party_door_size: order.party_door_size,
          door_taken_size: order.door_taken_size,
          door_type_name: order.door_type_name,
          door_made: null,
          front_mica: order.front_mica,
          back_mica: order.back_mica,
          billable_sqft: null,
          qty: 1,
          rate_per_sqft: Number(order.rate),
          mica_addon: 0,
          line_total: Number(order.total),
        }];
  const doc = buildDoorOrderPdf({
    shop: shopRes,
    order: {
      order_no: order.order_no,
      order_date: order.order_date,
      category: order.category,
      customer_name: order.customer_name,
      total: Number(order.total),
      notes: order.notes ?? null,
    },
    customer: (custRes.data as any) ?? null,
    items,
  });
  openPdfInNewTab(doc);
}

function mergeDefaultDoorTypes(doorTypes: DoorType[]) {
  const existingNames = new Set(doorTypes.map((d) => d.name.toLowerCase()));
  const missingDefaults = DEFAULT_DOOR_TYPE_NAMES.filter((name) => !existingNames.has(name.toLowerCase())).map((name) => ({
    id: `default:${name}`,
    name,
    rate: 0,
    active: true,
  }));

  return [...doorTypes, ...missingDefaults].sort((a, b) => a.name.localeCompare(b.name));
}

function dbDoorTypeId(id: string) {
  return id.startsWith("default:") ? null : id;
}

async function ensureDefaultDoorTypes() {
  const defaults = DEFAULT_DOOR_TYPE_NAMES.map((name) => ({ name, rate: 0, active: true }));
  await supabase.from("door_types").upsert(defaults, { onConflict: "name", ignoreDuplicates: true });
  await supabase.from("door_types").update({ active: true }).in("name", [...DEFAULT_DOOR_TYPE_NAMES]);
}

function DoorPage() {
  const search = Route.useSearch();
  const isFromSale = search.returnTo === "sale";
  const nav = useNavigate();
  const [tab, setTab] = useState<Category>("general");
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useQuery({
    queryKey: ["door-data"],
    queryFn: async () => {
      await ensureDefaultDoorTypes();
      const [dt, oo, cu] = await Promise.all([
        supabase.from("door_types").select("*").eq("active", true).order("name"),
        supabase.from("door_orders").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("customers").select("id,name,phone").order("name"),
      ]);
      return {
        doorTypes: ((dt.data as any) ?? []) as DoorType[],
        orders: ((oo.data as any) ?? []) as DoorOrder[],
        customers: ((cu.data as any) ?? []) as Customer[],
      };
    },
    staleTime: 60_000,
  });
  const doorTypes = data?.doorTypes ?? [];
  const orders = data?.orders ?? [];
  const customers = data?.customers ?? [];
  const reload = () => queryClient.invalidateQueries({ queryKey: ["door-data"] });
  const addCustomer = (c: Customer) =>
    queryClient.setQueryData(["door-data"], (prev: any) =>
      prev ? { ...prev, customers: [...prev.customers, c].sort((a: Customer, b: Customer) => a.name.localeCompare(b.name)) } : prev,
    );

  const selectableDoorTypes = useMemo(() => mergeDefaultDoorTypes(doorTypes), [doorTypes]);

  const filtered = useMemo(
    () => orders.filter((o) => o.category === tab),
    [orders, tab],
  );

  return (
    <>
      <PageHeader
        title="Door"
        subtitle={isFromSale
          ? "Adding door(s) to current sale — fill details and tap 'Add to sale' to return."
          : "Record door orders. General builds a multi-line order priced per sqft; Vypaari uses the saved door-type rate."}
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-10 max-w-[1400px] mx-auto w-full">
        {isFromSale && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#a78bfa] bg-[#a78bfa]/10 px-4 py-2.5 text-sm">
            <div className="text-[#5b21b6] font-medium">
              Door entry mode: lines will be added to the open sales bill (no separate door order created).
            </div>
            <Button variant="outline" size="sm" onClick={() => nav({ to: "/sales/new" })}>
              Back to sale
            </Button>
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Category)}>
          <TabsList className="mb-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="vypaari">Vypaari</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-5">
            <GeneralOrderForm
              doorTypes={selectableDoorTypes}
              nextOrderNoHint={nextOrderNo(orders, "general")}
              customers={customers}
              onCustomerCreated={addCustomer}
              onSaved={reload}
              isFromSale={isFromSale}
            />
            {!isFromSale && <OrdersTable rows={filtered} loading={loading} />}
          </TabsContent>

          <TabsContent value="vypaari" className="space-y-5">
            <VypaariForm
              doorTypes={selectableDoorTypes}
              nextOrderNoHint={nextOrderNo(orders, "vypaari")}
              customers={customers}
              onCustomerCreated={addCustomer}
              onSaved={reload}
              isFromSale={isFromSale}
            />
            {!isFromSale && <OrdersTable rows={filtered} loading={loading} />}
          </TabsContent>
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

/* ---------- size helpers ---------- */
function parseInchSize(s: string): { l: number; w: number } | null {
  if (!s) return null;
  const cleaned = s.replace(/inches?/gi, "").replace(/in\b/gi, "").trim();
  const parts = cleaned.split(/[*x×]/i).map((p) => p.trim());
  if (parts.length !== 2) return null;
  const l = Number(parts[0]); const w = Number(parts[1]);
  if (!isFinite(l) || !isFinite(w) || l <= 0 || w <= 0) return null;
  return { l, w };
}
function toSqft(l: number, w: number) {
  return Math.round(((l * w) / 144) * 100) / 100;
}
function round2(n: number) { return Math.round(n * 100) / 100; }

/* ---------- General multi-line form ---------- */
type DoorLine = {
  key: string;
  party_door_size: string;
  front_mica: string;
  back_mica: string;
  door_taken_size: string;
  door_type_id: string;
  door_type_name: string;
  door_made: string;
  qty: number;
  party_sqft: number;
  taken_sqft: number;
  billable_sqft: number;
  rate_per_sqft: number;
  mica_addon: number;
  line_total: number;
};

function emptyLine(): Omit<DoorLine, "key"> {
  return {
    party_door_size: "", front_mica: "", back_mica: "", door_taken_size: "",
    door_type_id: "", door_type_name: "", door_made: "", qty: 1,
    party_sqft: 0, taken_sqft: 0, billable_sqft: 0, rate_per_sqft: 0,
    mica_addon: 0, line_total: 0,
  };
}

/* ---------- Enter-key navigation: focus next focusable field ---------- */
function focusNextOnEnter(
  e: React.KeyboardEvent<HTMLElement>,
  container: HTMLElement | null,
) {
  if (e.key !== "Enter") return;
  const tgt = e.target as HTMLElement;
  const tag = tgt.tagName;
  if (tag === "TEXTAREA") return; // allow newlines
  if (tag === "BUTTON") return;   // let buttons activate
  if (!container) return;
  e.preventDefault();
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled]), button[data-enter-stop="true"]',
    ),
  ).filter((el) => el.offsetParent !== null || el === tgt);
  const idx = focusables.indexOf(tgt);
  const next = focusables[idx + 1];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement && (next.type === "text" || next.type === "number" || next.type === "")) {
      try { next.select(); } catch {}
    }
  }
}

function GeneralOrderForm({
  doorTypes, nextOrderNoHint, customers, onCustomerCreated, onSaved, isFromSale,
}: {
  doorTypes: DoorType[]; nextOrderNoHint: string;
  customers: Customer[];
  onCustomerCreated: (c: Customer) => void;
  onSaved: () => void;
  isFromSale?: boolean;
}) {
  const nav = useNavigate();
  const [orderNo, setOrderNo] = useState(nextOrderNoHint);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DoorLine[]>([]);
  const [draft, setDraft] = useState(emptyLine());
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrderNo(nextOrderNoHint); }, [nextOrderNoHint]);

  // Prefill from sales draft when entered via "Add Door" on the sale screen.
  useEffect(() => {
    if (!isFromSale) return;
    try {
      const raw = sessionStorage.getItem("sale_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.invoiceNo) setOrderNo(d.invoiceNo);
      if (d.customerId) setCustomerId(d.customerId);
      else if (d.customerName) setCustomerName(d.customerName);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFromSale]);

  const partyParsed = parseInchSize(draft.party_door_size);
  const takenParsed = parseInchSize(draft.door_taken_size);
  const partySqft = partyParsed ? toSqft(partyParsed.l, partyParsed.w) : 0;
  const takenSqft = takenParsed ? toSqft(takenParsed.l, takenParsed.w) : 0;
  const billableSqft = Math.max(partySqft, takenSqft);
  const previewTotal = round2(
    billableSqft * (draft.rate_per_sqft || 0) * (draft.qty || 0) +
      (Number(draft.mica_addon) || 0),
  );

  const grandTotal = useMemo(
    () => round2(lines.reduce((a, l) => a + Number(l.line_total || 0), 0)),
    [lines],
  );

  const addLine = () => {
    if (!partyParsed) return toast.error("Party Door Size format: e.g. 72.05*32.28");
    if (!takenParsed) return toast.error("Door Taken Size format: e.g. 72.05*32.28");
    if (!draft.door_type_id) return toast.error("Select door type");
    if (!draft.door_made) return toast.error("Select Door Made");
    if (draft.qty < 1) return toast.error("Quantity must be at least 1");
    if (draft.rate_per_sqft <= 0) return toast.error("Enter price per sqft");

    const selectedType = doorTypes.find((d) => d.id === draft.door_type_id);
    const line: DoorLine = {
      ...draft,
      key: crypto.randomUUID(),
      door_type_name: selectedType?.name ?? "",
      party_sqft: partySqft,
      taken_sqft: takenSqft,
      billable_sqft: billableSqft,
      mica_addon: Number(draft.mica_addon) || 0,
      line_total: previewTotal,
    };
    setLines((prev) => [...prev, line]);
    setDraft(emptyLine());
  };

  const removeLine = (key: string) => setLines((p) => p.filter((l) => l.key !== key));

  const resetAll = () => {
    setCustomerId(""); setCustomerName(""); setNotes(""); setLines([]); setDraft(emptyLine());
  };

  const save = async () => {
    const finalCustomer = (customers.find((c) => c.id === customerId)?.name ?? customerName).trim();
    if (!isFromSale && !finalCustomer) return toast.error("Customer is required");
    if (lines.length === 0) return toast.error("Add at least one door");
    setBusy(true);

    // From-sale mode: push lines back into sales/new via sessionStorage
    if (isFromSale) {
      try {
        const doorProduct = await findOrCreateDoorProduct();
        const saleLines = lines.map((l) => ({
          product_id: doorProduct.id,
          item_instance_id: null,
          name: `Door — ${l.door_type_name || ""} ${l.door_taken_size || ""}${l.door_made ? ` (${l.door_made})` : ""}`.trim(),
          qty: l.qty,
          rate: l.qty > 0 ? Number(l.line_total) / l.qty : Number(l.line_total),
          gst_rate: Number(doorProduct.gst_rate ?? 18),
          hsn: null,
          unit: doorProduct.unit ?? "pcs",
          alt_unit: null,
          alt_conversion: null,
          is_lot: true,
        }));
        sessionStorage.setItem("pending_door_lines", JSON.stringify(saleLines));
        setBusy(false);
        toast.success(`Adding ${saleLines.length} door(s) to sale`);
        nav({ to: "/sales/new" });
        return;
      } catch (e: any) {
        setBusy(false);
        toast.error(e?.message ?? "Failed to attach door to sale");
        return;
      }
    }

    const { data: orderRow, error } = await supabase.from("door_orders").insert({
      order_no: orderNo,
      category: "general",
      customer_name: finalCustomer,
      rate: 0,
      total: grandTotal,
      notes: notes || null,
    }).select("id").single();
    if (error || !orderRow) {
      setBusy(false);
      toast.error(error?.message ?? "Failed to save order");
      return;
    }
    const orderId = (orderRow as any).id as string;
    const itemsPayload = lines.map((l) => ({
      order_id: orderId,
      party_door_size: l.party_door_size,
      front_mica: l.front_mica || null,
      back_mica: l.back_mica || null,
      door_taken_size: l.door_taken_size,
      door_type_id: dbDoorTypeId(l.door_type_id),
      door_type_name: l.door_type_name,
      door_made: l.door_made,
      qty: l.qty,
      party_sqft: l.party_sqft,
      taken_sqft: l.taken_sqft,
      billable_sqft: l.billable_sqft,
      rate_per_sqft: l.rate_per_sqft,
      mica_addon: l.mica_addon,
      line_total: l.line_total,
    }));
    const { error: itemsErr } = await (supabase as any)
      .from("door_order_items").insert(itemsPayload);
    if (itemsErr) {
      await supabase.from("door_orders").delete().eq("id", orderId);
      setBusy(false);
      toast.error(itemsErr.message);
      return;
    }
    setBusy(false);
    toast.success(`Order ${orderNo} saved (${lines.length} doors)`);
    try {
      const shop = await loadShopForPdf();
      const cust = await supabase.from("customers").select("phone,address")
        .eq("name", finalCustomer).maybeSingle();
      const doc = buildDoorOrderPdf({
        shop,
        order: {
          order_no: orderNo, order_date: new Date().toISOString(),
          category: "general", customer_name: finalCustomer,
          total: grandTotal, notes: notes || null,
        },
        customer: (cust.data as any) ?? null,
        items: lines,
      });
      openPdfInNewTab(doc);
    } catch (e) { console.error(e); }
    resetAll();
    onSaved();
  };

  return (
    <div className="space-y-5" ref={formRef} onKeyDown={(e) => focusNextOnEnter(e, formRef.current)}>
      {/* Header card */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <DoorOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-base">{isFromSale ? "Add door to sale (General)" : "New General door order"}</div>
            <div className="text-xs text-muted-foreground">
              Set order header, then add one or more doors below. Pricing uses sqft (larger of Party / Taken size).
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Order No.">
            <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
          </Field>
          <Field label="Date">
            <Input value={fmtDate(new Date())} disabled />
          </Field>
          <Field label={isFromSale ? "Customer (optional — sale already has one)" : "Customer / Name"}>
            <div className="flex gap-2">
              <select
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setCustomerName(""); }}
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={() => setCreateCustomerOpen(true)}>
                <Plus className="h-4 w-4" /> New
              </Button>
            </div>
          </Field>
        </div>
      </Card>

      {/* Line draft card */}
      <Card className="p-5 space-y-4">
        <div className="font-semibold text-sm">Add door</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Party Door Size (inches, e.g. 72.05*32.28)">
            <Input
              value={draft.party_door_size}
              onChange={(e) => setDraft({ ...draft, party_door_size: e.target.value })}
              placeholder="72.05*32.28"
            />
          </Field>
          <Field label="Front Mica">
            <Input value={draft.front_mica} onChange={(e) => setDraft({ ...draft, front_mica: e.target.value })} />
          </Field>
          <Field label="Back Mica">
            <Input value={draft.back_mica} onChange={(e) => setDraft({ ...draft, back_mica: e.target.value })} />
          </Field>

          <Field label="Door Taken Size (inches, e.g. 72.05*32.28)">
            <Input
              value={draft.door_taken_size}
              onChange={(e) => setDraft({ ...draft, door_taken_size: e.target.value })}
              placeholder="72.05*32.28"
            />
          </Field>
          <Field label="Door Type">
            <Select
              value={draft.door_type_id}
              onValueChange={(v) => setDraft({ ...draft, door_type_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={doorTypes.length ? "Select door type" : "Add types in Settings"} />
              </SelectTrigger>
              <SelectContent>
                {doorTypes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Door Made">
            <Select
              value={draft.door_made}
              onValueChange={(v) => setDraft({ ...draft, door_made: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {DOOR_MADE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Quantity">
            <Input
              type="number" min={1}
              value={draft.qty}
              onChange={(e) => setDraft({ ...draft, qty: Math.max(1, parseInt(e.target.value || "1", 10)) })}
            />
          </Field>
          <Field label="Price (per sqft)">
            <Input
              type="number" min={0}
              value={draft.rate_per_sqft}
              onChange={(e) => setDraft({ ...draft, rate_per_sqft: Number(e.target.value || 0) })}
            />
          </Field>
          <Field label="Mica Add-on">
            <Input
              type="number" min={0}
              value={draft.mica_addon}
              onChange={(e) => setDraft({ ...draft, mica_addon: Number(e.target.value || 0) })}
              placeholder="0"
            />
          </Field>
          <Field label="Total">
            <Input value={inr(previewTotal)} disabled />
          </Field>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            Party {partySqft.toFixed(2)} sqft · Taken {takenSqft.toFixed(2)} sqft · Line total{" "}
            <span className="font-semibold text-foreground">{inr(previewTotal)}</span>
          </div>
          <Button onClick={addLine} className="gap-2">
            <Plus className="h-4 w-4" /> Add door
          </Button>
        </div>
      </Card>

      {/* Lines table */}
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 font-semibold">Doors in this order</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">#</TableHead>
              <TableHead>Party size</TableHead>
              <TableHead>Taken size</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Made</TableHead>
              <TableHead>Front mica</TableHead>
              <TableHead>Back mica</TableHead>
              <TableHead className="text-right">Sqft</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate/sqft</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="pr-5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={l.key}>
                <TableCell className="pl-5">{i + 1}</TableCell>
                <TableCell>{l.party_door_size}</TableCell>
                <TableCell>{l.door_taken_size}</TableCell>
                <TableCell>{l.door_type_name}</TableCell>
                <TableCell>{l.door_made}</TableCell>
                <TableCell>{l.front_mica || "—"}</TableCell>
                <TableCell>{l.back_mica || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{l.billable_sqft.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{l.qty}</TableCell>
                <TableCell className="text-right tabular-nums">{inr(l.rate_per_sqft)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{inr(l.line_total)}</TableCell>
                <TableCell className="pr-5">
                  <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No doors added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex items-end justify-between gap-3 p-5 border-t">
          <div className="w-full max-w-md">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Grand total</div>
            <div className="text-2xl font-semibold tabular-nums">{inr(grandTotal)}</div>
            <div className="flex gap-2 mt-3 justify-end">
              <Button variant="ghost" onClick={resetAll}>Reset</Button>
              <Button onClick={save} disabled={busy || lines.length === 0} className="gap-2">
                <Plus className="h-4 w-4" /> {busy ? "Saving…" : (isFromSale ? "Add to sale" : "Save order")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <QuickCreatePartyDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        kind="customer"
        onCreated={(c) => {
          onCustomerCreated(c as Customer);
          setCustomerId((c as Customer).id);
          setCustomerName("");
        }}
      />
    </div>
  );
}

/* ---------- Vypaari form (unchanged behavior) ---------- */
function VypaariForm({
  doorTypes, nextOrderNoHint, customers, onCustomerCreated, onSaved, isFromSale,
}: {
  doorTypes: DoorType[]; nextOrderNoHint: string;
  customers: Customer[];
  onCustomerCreated: (c: Customer) => void;
  onSaved: () => void;
  isFromSale?: boolean;
}) {
  const nav = useNavigate();
  const [orderNo, setOrderNo] = useState(nextOrderNoHint);
  const [customerId, setCustomerId] = useState("");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [partySize, setPartySize] = useState("");
  const [frontMica, setFrontMica] = useState("");
  const [backMica, setBackMica] = useState("");
  const [takenSize, setTakenSize] = useState("");
  const [doorTypeId, setDoorTypeId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrderNo(nextOrderNoHint); }, [nextOrderNoHint]);

  const selectedType = doorTypes.find((d) => d.id === doorTypeId);

  // Prefill from sales draft when entered via "Add Door" on the sale screen.
  useEffect(() => {
    if (!isFromSale) return;
    try {
      const raw = sessionStorage.getItem("sale_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.invoiceNo) setOrderNo(d.invoiceNo);
      if (d.customerId) setCustomerId(d.customerId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFromSale]);
  const rate = Number(selectedType?.rate ?? 0);
  const total = rate * (qty || 0);

  const reset = () => {
    setCustomerId(""); setPartySize(""); setFrontMica(""); setBackMica("");
    setTakenSize(""); setDoorTypeId(""); setQty(1); setNotes("");
  };

  const save = async () => {
    const customerName = (customers.find((c) => c.id === customerId)?.name ?? "").trim();
    if (!isFromSale && !customerName) { toast.error("Select a customer"); return; }
    if (!doorTypeId) { toast.error("Select a door type"); return; }
    if (!selectedType) { toast.error("Door type rate missing"); return; }
    setBusy(true);

    if (isFromSale) {
      try {
        const doorProduct = await findOrCreateDoorProduct();
        const label = `Door — ${selectedType?.name ?? ""} ${takenSize || partySize || ""}`.trim();
        const saleLine = {
          product_id: doorProduct.id,
          item_instance_id: null,
          name: label,
          qty,
          rate,
          gst_rate: Number(doorProduct.gst_rate ?? 18),
          hsn: null,
          unit: doorProduct.unit ?? "pcs",
          alt_unit: null,
          alt_conversion: null,
          is_lot: true,
        };
        sessionStorage.setItem("pending_door_lines", JSON.stringify([saleLine]));
        setBusy(false);
        toast.success("Adding door to sale");
        nav({ to: "/sales/new" });
        return;
      } catch (e: any) {
        setBusy(false);
        toast.error(e?.message ?? "Failed to attach door to sale");
        return;
      }
    }

    const { error } = await supabase.from("door_orders").insert({
      order_no: orderNo,
      category: "vypaari",
      customer_name: customerName,
      party_door_size: partySize || null,
      front_mica: frontMica || null,
      back_mica: backMica || null,
      door_taken_size: takenSize || null,
      door_type_id: dbDoorTypeId(doorTypeId),
      door_type_name: selectedType?.name ?? null,
      rate,
      total,
      notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Door order saved");
    try {
      const shop = await loadShopForPdf();
      const cust = await supabase.from("customers").select("phone,address")
        .eq("id", customerId).maybeSingle();
      const doc = buildDoorOrderPdf({
        shop,
        order: {
          order_no: orderNo, order_date: new Date().toISOString(),
          category: "vypaari", customer_name: customerName,
          total, notes: notes || null,
        },
        customer: (cust.data as any) ?? null,
        items: [{
          party_door_size: partySize, door_taken_size: takenSize,
          door_type_name: selectedType?.name ?? null, door_made: null,
          front_mica: frontMica, back_mica: backMica,
          billable_sqft: null, qty, rate_per_sqft: rate,
          mica_addon: 0, line_total: total,
        }],
      });
      openPdfInNewTab(doc);
    } catch (e) { console.error(e); }
    reset();
    onSaved();
  };

  return (
    <Card className="p-5 space-y-4" ref={formRef as any} onKeyDown={(e) => focusNextOnEnter(e, formRef.current)}>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <DoorOpen className="h-4 w-4" />
        </div>
        <div>
          <div className="font-semibold text-base">New Vypaari door order</div>
          <div className="text-xs text-muted-foreground">Rate is auto-filled from the selected door type.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Order No."><Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} /></Field>
        <Field label="Date"><Input value={fmtDate(new Date())} disabled /></Field>
        <Field label="Customer / Name">
          <div className="flex gap-2">
            <select
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={() => setCreateCustomerOpen(true)}>
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
        </Field>

        <Field label="Party Door Size">
          <Input value={partySize} onChange={(e) => setPartySize(e.target.value)} placeholder="e.g. 7x3" />
        </Field>
        <Field label="Front Mica"><Input value={frontMica} onChange={(e) => setFrontMica(e.target.value)} /></Field>
        <Field label="Back Mica"><Input value={backMica} onChange={(e) => setBackMica(e.target.value)} /></Field>

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
                <SelectItem key={d.id} value={d.id}>{d.name} — {inr(Number(d.rate))}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quantity">
          <Input type="number" min={1} value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))} />
        </Field>

        <Field label="Rate (auto)"><Input type="number" value={rate} disabled /></Field>
        <Field label="Total"><Input value={inr(total)} disabled /></Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} placeholder="Optional" />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={reset}>Reset</Button>
        <Button onClick={save} disabled={busy} className="gap-2">
          <Plus className="h-4 w-4" /> {busy ? "Saving…" : (isFromSale ? "Add to sale" : "Save order")}
        </Button>
      </div>
      <QuickCreatePartyDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        kind="customer"
        onCreated={(c) => {
          onCustomerCreated(c as Customer);
          setCustomerId((c as Customer).id);
        }}
      />
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
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
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="pr-5 text-right">Bill</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id} className="cursor-pointer" onClick={() => openDoorOrderPdf(o)}>
              <TableCell className="pl-5 font-medium">{o.order_no}</TableCell>
              <TableCell>{fmtDate(o.order_date)}</TableCell>
              <TableCell>{o.customer_name}</TableCell>
              <TableCell>{o.door_type_name ?? "—"}</TableCell>
              <TableCell>{o.door_taken_size ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{inr(Number(o.rate))}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{inr(Number(o.total))}</TableCell>
              <TableCell className="pr-5 text-right">
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDoorOrderPdf(o); }}>
                  <FileText className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                No door orders yet in this category.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

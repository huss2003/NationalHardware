import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { ScanInput } from "@/components/erp/ScanInput";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";
import { inr } from "@/lib/codes";
import { AlertOctagon, Trash2 } from "lucide-react";
import { useUiConfig } from "@/lib/ui-config";

export const Route = createFileRoute("/_app/sales/new")({ component: NewSale });

type Line = { product_id: string; item_instance_id: string | null; name: string; qty: number; rate: number; gst_rate: number };

function NewSale() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const cfg = useUiConfig();
  const f = cfg.forms.new_sale.fields;
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerState, setCustomerState] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [warn, setWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("customers").select("*").order("name").then(({ data }) => setCustomers(data ?? []));
  }, []);
  useEffect(() => {
    const c = customers.find((x) => x.id === customerId);
    setCustomerState(c?.state ?? "");
  }, [customerId, customers]);

  const onScan = async (code: string) => {
    setWarn(null);
    const { data: item } = await supabase.from("item_instances").select("*, products(*)").eq("id", code).maybeSingle();
    if (!item) { setWarn(`No item with ID ${code}`); return; }
    if (item.status !== "available") { setWarn(`Item ${code} is ${item.status.toUpperCase()} — cannot sell!`); return; }
    if (lines.find(l => l.item_instance_id === code)) { setWarn(`Already in cart`); return; }
    setLines([...lines, {
      product_id: item.product_id, item_instance_id: item.id, name: item.products.name,
      qty: 1, rate: Number(item.products.default_price), gst_rate: Number(item.products.gst_rate),
    }]);
    toast.success(`Added ${item.id}`);
  };

  const rm = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<Line>) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const subtotal = lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const tax = lines.reduce((a, l) => a + (l.qty * l.rate * l.gst_rate / 100), 0);
  const total = subtotal + tax - discount;

  const save = async () => {
    if (lines.length === 0) { toast.error("Scan or add items"); return; }
    if (f.customer.visible && f.customer.required && !customerId) { toast.error("Customer is required"); return; }
    if (f.payment_mode.visible && f.payment_mode.required && !paymentMode) { toast.error("Payment mode is required"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("record_sale", {
      _payload: {
        customer_id: customerId || null,
        customer_state: customerState,
        payment_mode: paymentMode,
        paid_amount: paymentMode === "cash" ? total : 0,
        discount,
        items: lines,
      } as any,
      _actor_user_id: user?.id ?? "",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sale recorded");
    nav({ to: "/sales/$id", params: { id: data as string } });
  };

  return (
    <>
      <PageHeader title="New sale" subtitle="Scan items to add — barcode or QR" />
      <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <ScanInput onScan={onScan} />
          {warn && (
            <div className="p-4 rounded-xl bg-destructive text-destructive-foreground flex items-center gap-3 font-bold">
              <AlertOctagon className="h-6 w-6" /> {warn}
            </div>
          )}
          <Card className="overflow-hidden">
            {lines.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">No items scanned yet</div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted text-left text-sm">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Rate</th>
                    {f.gst_rate.visible && <th className="p-3">GST%</th>}
                    <th className="p-3">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">
                        <div className="font-bold">{l.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{l.item_instance_id}</div>
                      </td>
                      <td className="p-3"><Input className="w-20 h-10" type="number" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></td>
                      <td className="p-3"><Input className="w-28 h-10" type="number" value={l.rate} onChange={(e) => upd(i, { rate: Number(e.target.value) })} /></td>
                      {f.gst_rate.visible && (
                        <td className="p-3"><Input className="w-20 h-10" type="number" value={l.gst_rate} onChange={(e) => upd(i, { gst_rate: Number(e.target.value) })} /></td>
                      )}
                      <td className="p-3 font-bold">{inr(l.qty * l.rate)}</td>
                      <td className="p-3"><Button variant="ghost" size="icon" onClick={() => rm(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card className="p-5 space-y-3 h-fit sticky top-4">
          {f.customer.visible && (
            <select className="h-12 w-full rounded-md border bg-background px-3" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{f.customer.required ? "-- Customer * --" : "Walk-in customer"}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {f.payment_mode.visible && (
            <select className="h-12 w-full rounded-md border bg-background px-3 font-semibold" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
            </select>
          )}
          {f.discount.visible && (
            <Input className="h-12" type="number" placeholder={`Discount ₹${f.discount.required ? " *" : ""}`} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          )}
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between"><span>Subtotal</span><b>{inr(subtotal)}</b></div>
            <div className="flex justify-between"><span>GST</span><b>{inr(tax)}</b></div>
            {f.discount.visible && (
              <div className="flex justify-between"><span>Discount</span><b>− {inr(discount)}</b></div>
            )}
            <div className="flex justify-between text-2xl"><span>Total</span><b>{inr(total)}</b></div>
          </div>
          <Button className="w-full h-14 text-lg" disabled={busy} onClick={save}>Save invoice</Button>
        </Card>
      </div>
    </>
  );
}

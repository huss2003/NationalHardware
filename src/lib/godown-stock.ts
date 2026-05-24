import { supabase } from "@/integrations/supabase/client";
import { mintReprintForSale, type MintedSticker } from "@/lib/relabel";

export type SelectedUnit = {
  id: string;
  product_id: string;
  is_lot: boolean;
  qty_on_hand: number;
  cost_price: number;
  rate?: number; // for sale attach
  gst_rate?: number;
  takeQty?: number; // for lots
  productName?: string;
};

/** Move existing item_instances into a godown. */
export async function moveToGodown(
  itemIds: string[],
  godownId: string,
  actorUserId: string | null | undefined,
): Promise<void> {
  if (itemIds.length === 0) return;
  const { error } = await supabase
    .from("item_instances")
    .update({ godown_id: godownId, updated_at: new Date().toISOString() })
    .in("id", itemIds);
  if (error) throw error;
  await supabase.from("item_history").insert(
    itemIds.map((id) => ({
      item_id: id,
      event: "moved" as const,
      actor_user_id: actorUserId ?? null,
      notes: `Stocked into godown ${godownId}`,
    })),
  );
}

/** Mint fresh item_instances directly into a godown (Stock In → Receive new). */
export async function mintFreshIntoGodown(
  productId: string,
  qty: number,
  godownId: string,
  costPrice: number,
  actorUserId: string | null | undefined,
): Promise<MintedSticker[]> {
  const { data: p, error: pErr } = await supabase
    .from("products")
    .select("id, name, prefix, category, default_cost")
    .eq("id", productId)
    .single();
  if (pErr || !p) throw pErr ?? new Error("Product not found");
  const cost = Number(costPrice ?? p.default_cost ?? 0);
  const out: MintedSticker[] = [];

  if (p.category === "hardware") {
    // Find existing lot in this godown, else create one
    const { data: lot } = await supabase
      .from("item_instances")
      .select("id, qty_on_hand")
      .eq("product_id", p.id)
      .eq("is_lot", true)
      .eq("status", "available")
      .eq("godown_id", godownId)
      .limit(1)
      .maybeSingle();
    if (lot) {
      const { error: uErr } = await supabase
        .from("item_instances")
        .update({ qty_on_hand: Number(lot.qty_on_hand) + qty, cost_price: cost, updated_at: new Date().toISOString() })
        .eq("id", lot.id);
      if (uErr) throw uErr;
      await supabase.from("item_history").insert({
        item_id: lot.id, event: "purchased" as const,
        actor_user_id: actorUserId ?? null,
        notes: `Godown stock-in lot +${qty}`,
      });
      const { data: refreshed } = await supabase
        .from("item_instances").select("id, qr_payload").eq("id", lot.id).single();
      out.push({ id: lot.id, name: p.name, qr_payload: refreshed?.qr_payload ?? { id: lot.id, name: p.name } });
      return out;
    }
    const newId = await allocId((p.prefix ?? "").toUpperCase());
    const qr = { id: newId, name: p.name, date: new Date().toISOString().slice(0, 10), status: "available", lot: true };
    const { error: iErr } = await supabase.from("item_instances").insert({
      id: newId, product_id: p.id, status: "available", cost_price: cost,
      barcode_payload: newId, qr_payload: qr, is_lot: true, qty_on_hand: qty, godown_id: godownId,
    });
    if (iErr) throw iErr;
    await supabase.from("item_history").insert({
      item_id: newId, event: "purchased" as const,
      actor_user_id: actorUserId ?? null,
      notes: `Godown stock-in new lot qty ${qty}`,
    });
    out.push({ id: newId, name: p.name, qr_payload: qr });
    return out;
  }

  for (let i = 0; i < Math.max(1, qty); i++) {
    const newId = await allocId((p.prefix ?? "").toUpperCase());
    const qr = { id: newId, name: p.name, date: new Date().toISOString().slice(0, 10), status: "available" };
    const { error: iErr } = await supabase.from("item_instances").insert({
      id: newId, product_id: p.id, status: "available", cost_price: cost,
      barcode_payload: newId, qr_payload: qr, is_lot: false, qty_on_hand: 1, godown_id: godownId,
    });
    if (iErr) throw iErr;
    await supabase.from("item_history").insert({
      item_id: newId, event: "purchased" as const,
      actor_user_id: actorUserId ?? null,
      notes: "Godown stock-in fresh unit",
    });
    out.push({ id: newId, name: p.name, qr_payload: qr });
  }
  return out;
}

async function allocId(prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_item_id", { _prefix: prefix });
  if (error || !data) throw error ?? new Error("Could not allocate item ID");
  return data as string;
}

/** Stock Out → Shop floor (godown_id = null). No new stickers — existing barcode follows the item. */
export async function moveOutToShop(
  units: SelectedUnit[],
  actorUserId: string | null | undefined,
): Promise<void> {
  for (const u of units) {
    if (u.is_lot) {
      const take = Math.max(1, u.takeQty ?? 1);
      if (take > u.qty_on_hand) throw new Error(`Not enough lot stock on ${u.id}`);
      const remaining = u.qty_on_hand - take;

      if (remaining === 0) {
        // Move the whole lot row to shop
        const { error } = await supabase
          .from("item_instances")
          .update({ godown_id: null, updated_at: new Date().toISOString() })
          .eq("id", u.id);
        if (error) throw error;
      } else {
        // Decrement the godown lot
        const { error } = await supabase
          .from("item_instances")
          .update({ qty_on_hand: remaining, updated_at: new Date().toISOString() })
          .eq("id", u.id);
        if (error) throw error;
        // Find or create a shop-side lot row for this product
        const { data: shopLot } = await supabase
          .from("item_instances")
          .select("id, qty_on_hand")
          .eq("product_id", u.product_id)
          .eq("is_lot", true)
          .eq("status", "available")
          .is("godown_id", null)
          .limit(1)
          .maybeSingle();
        if (shopLot) {
          await supabase
            .from("item_instances")
            .update({ qty_on_hand: Number(shopLot.qty_on_hand) + take, updated_at: new Date().toISOString() })
            .eq("id", shopLot.id);
        } else {
          // Mirror the existing lot's barcode/qr to a new shop row
          const { data: src } = await supabase
            .from("item_instances")
            .select("id, qr_payload, barcode_payload, cost_price, product_id, products(prefix, name)")
            .eq("id", u.id).single();
          // Allocate a fresh ID for the shop lot so it doesn't collide
          const prefix = String(((src as any)?.products?.prefix ?? "")).toUpperCase();
          const { data: newId } = await supabase.rpc("next_item_id", { _prefix: prefix });
          const id = String(newId);
          await supabase.from("item_instances").insert({
            id, product_id: u.product_id, status: "available", cost_price: Number(src?.cost_price ?? 0),
            barcode_payload: id, qr_payload: { id, name: (src as any)?.products?.name ?? u.productName, lot: true },
            is_lot: true, qty_on_hand: take, godown_id: null,
          });
        }
      }
      await supabase.from("item_history").insert({
        item_id: u.id, event: "moved" as const,
        actor_user_id: actorUserId ?? null,
        notes: `Stock out to shop, qty ${take}`,
      });
    } else {
      const { error } = await supabase
        .from("item_instances")
        .update({ godown_id: null, updated_at: new Date().toISOString() })
        .eq("id", u.id);
      if (error) throw error;
      await supabase.from("item_history").insert({
        item_id: u.id, event: "moved" as const,
        actor_user_id: actorUserId ?? null,
        notes: "Stock out to shop",
      });
    }
  }
}

/** Stock Out → attach to existing sales bill. Mints fresh stickers and marks original sold. */
export async function moveOutToSale(
  units: SelectedUnit[],
  saleId: string,
  actorUserId: string | null | undefined,
): Promise<MintedSticker[]> {
  const stickers: MintedSticker[] = [];
  // Load sale for recompute
  const { data: sale, error: sErr } = await supabase
    .from("sales").select("id, subtotal, cgst, sgst, igst, grand_total, discount, customer_id")
    .eq("id", saleId).single();
  if (sErr || !sale) throw sErr ?? new Error("Sale not found");

  let addedSub = 0;
  let addedTax = 0;

  for (const u of units) {
    const qty = u.is_lot ? Math.max(1, u.takeQty ?? 1) : 1;
    const rate = Number(u.rate ?? u.cost_price ?? 0);
    const gst = Number(u.gst_rate ?? 18);
    const lineTotal = qty * rate;
    const lineTax = Math.round(lineTotal * gst) / 100;

    // Insert sales_items line
    const { error: liErr } = await supabase.from("sales_items").insert({
      sale_id: saleId,
      product_id: u.product_id,
      item_instance_id: u.id,
      qty, rate, gst_rate: gst, line_total: lineTotal,
    });
    if (liErr) throw liErr;

    if (u.is_lot) {
      const newQty = u.qty_on_hand - qty;
      const { error } = await supabase
        .from("item_instances")
        .update({
          qty_on_hand: newQty,
          status: newQty <= 0 ? "sold" : "available",
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.id);
      if (error) throw error;
      await supabase.from("item_history").insert({
        item_id: u.id, event: "sold" as const,
        ref_table: "sales", ref_id: saleId,
        actor_user_id: actorUserId ?? null,
        notes: `Stock out to sale, qty ${qty}`,
      });
      stickers.push({ id: u.id, name: u.productName ?? u.id, qr_payload: { id: u.id, name: u.productName, lot: true } });
    } else {
      const { error } = await supabase
        .from("item_instances").update({ status: "sold", updated_at: new Date().toISOString() })
        .eq("id", u.id);
      if (error) throw error;
      const minted = await mintReprintForSale(u.id, actorUserId ?? null, `Stock out to sale ${saleId}`);
      await supabase.from("item_history").insert({
        item_id: u.id, event: "sold" as const,
        ref_table: "sales", ref_id: saleId,
        actor_user_id: actorUserId ?? null,
        notes: `Reprinted as ${minted.id}`,
      });
      stickers.push(minted);
    }

    addedSub += lineTotal;
    addedTax += lineTax;
  }

  // Recompute totals: split into cgst/sgst if customer in same state, else igst.
  // Simple approach: mirror existing distribution proportions, else split cgst+sgst.
  const newSub = Number(sale.subtotal ?? 0) + addedSub;
  const hadIgst = Number(sale.igst ?? 0) > 0;
  let newCgst = Number(sale.cgst ?? 0);
  let newSgst = Number(sale.sgst ?? 0);
  let newIgst = Number(sale.igst ?? 0);
  if (hadIgst) newIgst += addedTax;
  else { newCgst += addedTax / 2; newSgst += addedTax / 2; }
  const grand = newSub - Number(sale.discount ?? 0) + newCgst + newSgst + newIgst;

  const { error: upErr } = await supabase.from("sales").update({
    subtotal: newSub, cgst: newCgst, sgst: newSgst, igst: newIgst, grand_total: grand,
    updated_at: new Date().toISOString(),
  }).eq("id", saleId);
  if (upErr) throw upErr;

  return stickers;
}
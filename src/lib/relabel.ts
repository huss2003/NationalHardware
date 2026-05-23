import { supabase } from "@/integrations/supabase/client";

async function allocId(prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_item_id", { _prefix: prefix });
  if (error || !data) throw error ?? new Error("Could not allocate item ID");
  return data as string;
}

async function loadProduct(productId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, prefix, category")
    .eq("id", productId)
    .single();
  if (error || !data) throw error ?? new Error("Product not found");
  return data;
}

export type MintedSticker = {
  id: string;
  name: string;
  qr_payload: any;
};

/**
 * Sales-side reprint: mint a fresh sequential sticker for the SAME product
 * as the original instance. The original row is left untouched (its status
 * will be set to "returned" by the sales-return save flow).
 */
export async function mintReprintForSale(
  originalItemId: string,
  actorUserId: string | null | undefined,
  contextNote?: string,
): Promise<MintedSticker> {
  const { data: orig, error: oErr } = await supabase
    .from("item_instances")
    .select("id, product_id, cost_price")
    .eq("id", originalItemId)
    .single();
  if (oErr || !orig) throw oErr ?? new Error("Original item not found");
  const p = await loadProduct(orig.product_id);
  const newId = await allocId((p.prefix ?? "").toUpperCase());
  const qr = {
    id: newId,
    name: p.name,
    date: new Date().toISOString().slice(0, 10),
    status: "available",
    replaces: originalItemId,
  };
  const { error: iErr } = await supabase.from("item_instances").insert({
    id: newId,
    product_id: p.id,
    status: "available",
    cost_price: Number(orig.cost_price ?? 0),
    barcode_payload: newId,
    qr_payload: qr,
    is_lot: false,
    qty_on_hand: 1,
  });
  if (iErr) throw iErr;
  await supabase.from("item_history").insert([
    {
      item_id: newId,
      event: "minted",
      actor_user_id: actorUserId ?? null,
      notes: contextNote ?? `Reprint replacement for ${originalItemId}`,
    },
    {
      item_id: originalItemId,
      event: "reprinted",
      actor_user_id: actorUserId ?? null,
      notes: `Sticker reprinted as ${newId}`,
    },
  ]);
  return { id: newId, name: p.name, qr_payload: qr };
}

/**
 * Purchase-side replacement: mint brand-new sticker(s) for a chosen product
 * (defaults to same product). Used when the supplier sends a replacement piece.
 */
export async function mintReplacementForPurchase(
  originalItemId: string,
  productId: string,
  qty: number,
  actorUserId: string | null | undefined,
  returnId?: string,
): Promise<MintedSticker[]> {
  const { data: orig, error: oErr } = await supabase
    .from("item_instances")
    .select("id, cost_price, source_purchase_item_id")
    .eq("id", originalItemId)
    .single();
  if (oErr || !orig) throw oErr ?? new Error("Original item not found");
  const p = await loadProduct(productId);
  const out: MintedSticker[] = [];
  for (let i = 0; i < Math.max(1, qty); i++) {
    const newId = await allocId((p.prefix ?? "").toUpperCase());
    const qr = {
      id: newId,
      name: p.name,
      date: new Date().toISOString().slice(0, 10),
      status: "available",
      replaces: originalItemId,
    };
    const { error: iErr } = await supabase.from("item_instances").insert({
      id: newId,
      product_id: p.id,
      source_purchase_item_id: orig.source_purchase_item_id ?? null,
      status: "available",
      cost_price: Number(orig.cost_price ?? 0),
      barcode_payload: newId,
      qr_payload: qr,
      is_lot: false,
      qty_on_hand: 1,
    });
    if (iErr) throw iErr;
    await supabase.from("item_history").insert({
      item_id: newId,
      event: "minted",
      ref_table: returnId ? "purchase_returns" : null,
      ref_id: returnId ?? null,
      actor_user_id: actorUserId ?? null,
      notes: `Replacement for ${originalItemId}`,
    });
    out.push({ id: newId, name: p.name, qr_payload: qr });
  }
  return out;
}
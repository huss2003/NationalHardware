import { supabase } from "@/integrations/supabase/client";

// Seeds a minimal set of demo data so all list / detail routes have rows to render.
// Idempotent-ish: re-runnable; will append additional rows each time.
export async function seedDemoData(actorId: string) {
  const log: string[] = [];

  // Supplier
  const { data: supplier, error: supErr } = await supabase
    .from("suppliers")
    .insert({ name: `Demo Supplier ${Date.now().toString().slice(-4)}`, phone: "9000000001", state: "KA" })
    .select()
    .single();
  if (supErr) throw supErr;
  log.push(`Supplier ${supplier.name}`);

  // Customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({ name: `Demo Customer ${Date.now().toString().slice(-4)}`, phone: "9000000002", state: "KA" })
    .select()
    .single();
  if (custErr) throw custErr;
  log.push(`Customer ${customer.name}`);

  // Product (ensure at least one active product exists)
  let { data: products } = await supabase.from("products").select("*").eq("active", true).limit(1);
  let product = products?.[0];
  if (!product) {
    const prefix = "DEMO";
    const { data: created, error: pErr } = await supabase
      .from("products")
      .insert({
        name: "Demo Widget",
        prefix,
        category: "other",
        unit: "pcs",
        default_cost: 100,
        default_price: 150,
        gst_rate: 18,
        reorder_level: 5,
        active: true,
      })
      .select()
      .single();
    if (pErr) throw pErr;
    product = created;
    log.push(`Product ${product.name}`);
  }

  // Purchase + items + mint units
  const qty = 3;
  const rate = Number(product.default_cost) || 100;
  const subtotal = qty * rate;
  const tax = (subtotal * Number(product.gst_rate)) / 100;
  const { data: purchase, error: purErr } = await supabase
    .from("purchases")
    .insert({
      supplier_id: supplier.id,
      bill_no: `DEMO-${Date.now().toString().slice(-5)}`,
      bill_date: new Date().toISOString().slice(0, 10),
      subtotal,
      tax_total: tax,
      grand_total: subtotal + tax,
      notes: "Seeded demo purchase",
      created_by: actorId,
    })
    .select()
    .single();
  if (purErr) throw purErr;

  const { data: pi, error: piErr } = await supabase
    .from("purchase_items")
    .insert({
      purchase_id: purchase.id,
      product_id: product.id,
      qty,
      rate,
      gst_rate: Number(product.gst_rate),
      line_total: subtotal,
    })
    .select()
    .single();
  if (piErr) throw piErr;

  const { data: minted, error: mintErr } = await supabase.rpc("mint_item_instances", {
    _purchase_item_id: pi.id,
    _actor_user_id: actorId,
  });
  if (mintErr) throw mintErr;
  log.push(`Purchase ${purchase.bill_no} with ${qty} units`);

  // Sale of the first minted unit
  const firstUnit = Array.isArray(minted) ? minted[0] : null;
  if (firstUnit) {
    const { data: saleId, error: saleErr } = await supabase.rpc("record_sale", {
      _payload: {
        customer_id: customer.id,
        customer_state: "KA",
        payment_mode: "cash",
        paid_amount: Number(product.default_price) * 1.18,
        discount: 0,
        items: [
          {
            product_id: product.id,
            item_instance_id: firstUnit.id,
            qty: 1,
            rate: Number(product.default_price),
            gst_rate: Number(product.gst_rate),
          },
        ],
      } as any,
      _actor_user_id: actorId,
    });
    if (saleErr) throw saleErr;
    log.push(`Sale ${saleId}`);
  }

  // ---- Production: ensure finished product, BOM, then create + complete an order ----
  // Finished product (distinct from raw material so consumption makes sense).
  let { data: finishedRows } = await supabase
    .from("products")
    .select("*")
    .neq("id", product.id)
    .eq("active", true)
    .limit(1);
  let finished = finishedRows?.[0];
  if (!finished) {
    const { data: created, error: fErr } = await supabase
      .from("products")
      .insert({
        name: "Demo Assembly",
        prefix: "ASM",
        category: "other",
        unit: "pcs",
        default_cost: 250,
        default_price: 400,
        gst_rate: 18,
        reorder_level: 2,
        active: true,
      })
      .select()
      .single();
    if (fErr) throw fErr;
    finished = created;
    log.push(`Finished product ${finished.name}`);
  }

  // BOM: finished assembly consumes 1x raw material.
  let { data: bomRows } = await supabase
    .from("bom")
    .select("*")
    .eq("finished_product_id", finished.id)
    .eq("active", true)
    .limit(1);
  let bom = bomRows?.[0];
  if (!bom) {
    const { data: createdBom, error: bErr } = await supabase
      .from("bom")
      .insert({ finished_product_id: finished.id, version: 1, active: true })
      .select()
      .single();
    if (bErr) throw bErr;
    bom = createdBom;
    const { error: biErr } = await supabase
      .from("bom_items")
      .insert({ bom_id: bom.id, component_product_id: product.id, qty: 1 });
    if (biErr) throw biErr;
    log.push(`BOM v${bom.version} for ${finished.name}`);
  }

  const mintedUnits: any[] = Array.isArray(minted) ? minted.slice(1) : []; // unit[0] was sold

  // Helper: create one production order in the requested status, optionally
  // consuming a raw-material unit along the way.
  async function createOrder(opts: {
    status: "open" | "in_progress" | "completed";
    qty: number;
    label: string;
    consume?: string | null;
  }) {
    const { data: order, error: oErr } = await supabase
      .from("production_orders")
      .insert({
        finished_product_id: finished.id,
        bom_id: bom.id,
        qty: opts.qty,
        status: "open",
        notes: `Seeded: ${opts.label}`,
        created_by: actorId,
      })
      .select()
      .single();
    if (oErr) throw oErr;

    if (opts.consume) {
      const { error: cErr } = await supabase.rpc("consume_material", {
        _order_id: order.id,
        _item_id: opts.consume,
        _actor_user_id: actorId,
      });
      if (cErr) throw cErr;
    }

    if (opts.status === "in_progress") {
      const { error: uErr } = await supabase
        .from("production_orders")
        .update({ status: "in_progress" })
        .eq("id", order.id);
      if (uErr) throw uErr;
    } else if (opts.status === "completed") {
      const { error: compErr } = await supabase.rpc("complete_production", {
        _order_id: order.id,
        _actor_user_id: actorId,
      });
      if (compErr) throw compErr;
    }

    log.push(`${opts.status.toUpperCase()} order ${order.id.slice(0, 8)} — ${opts.label}`);
    return order;
  }

  // Open order — no materials consumed yet.
  await createOrder({ status: "open", qty: 1, label: "fresh order awaiting materials" });

  // In-progress order — one raw unit consumed, not yet completed.
  await createOrder({
    status: "in_progress",
    qty: 1,
    label: "materials consumed, on the floor",
    consume: mintedUnits[0]?.id ?? null,
  });

  // Completed order — consumes another raw unit and mints a finished unit.
  await createOrder({
    status: "completed",
    qty: 1,
    label: "shipped finished goods",
    consume: mintedUnits[1]?.id ?? null,
  });

  return log;
}
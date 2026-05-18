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

  return log;
}
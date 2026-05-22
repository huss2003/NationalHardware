
-- item_instances: hottest table
CREATE INDEX IF NOT EXISTS idx_item_instances_product_id ON public.item_instances(product_id);
CREATE INDEX IF NOT EXISTS idx_item_instances_status ON public.item_instances(status);
CREATE INDEX IF NOT EXISTS idx_item_instances_product_status ON public.item_instances(product_id, status);
CREATE INDEX IF NOT EXISTS idx_item_instances_source_purchase_item ON public.item_instances(source_purchase_item_id);
CREATE INDEX IF NOT EXISTS idx_item_instances_godown ON public.item_instances(godown_id);
CREATE INDEX IF NOT EXISTS idx_item_instances_barcode ON public.item_instances(barcode_payload);

-- item_history (timeline reads)
CREATE INDEX IF NOT EXISTS idx_item_history_item_created ON public.item_history(item_id, created_at DESC);

-- sales
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON public.sales(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_active_date ON public.sales(invoice_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON public.sales(invoice_no);

-- sales_items / sales_return_items
CREATE INDEX IF NOT EXISTS idx_sales_items_sale ON public.sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON public.sales_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_instance ON public.sales_items(item_instance_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON public.sales_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_product ON public.sales_return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale ON public.sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON public.sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON public.sales_returns(return_date DESC) WHERE deleted_at IS NULL;

-- purchases
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_bill_date ON public.purchases(bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_active_date ON public.purchases(bill_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON public.purchase_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_product ON public.purchase_return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON public.purchase_returns(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON public.purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON public.purchase_returns(return_date DESC) WHERE deleted_at IS NULL;

-- door
CREATE INDEX IF NOT EXISTS idx_door_orders_category_created ON public.door_orders(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_orders_created ON public.door_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_order_items_order ON public.door_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_door_types_active_name ON public.door_types(active, name);

-- receipts
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON public.receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_sale ON public.receipts(sale_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON public.receipts(created_at DESC);

-- production
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON public.production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_finished_product ON public.production_orders(finished_product_id);
CREATE INDEX IF NOT EXISTS idx_production_materials_order ON public.production_materials(order_id);
CREATE INDEX IF NOT EXISTS idx_produced_items_order ON public.produced_items(order_id);

-- bom
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON public.bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_finished_product ON public.bom(finished_product_id) WHERE active;

-- products
CREATE INDEX IF NOT EXISTS idx_products_active_name ON public.products(active, name);
CREATE INDEX IF NOT EXISTS idx_products_prefix ON public.products(prefix);

-- alerts / audit
CREATE INDEX IF NOT EXISTS idx_alerts_unread_created ON public.alerts(created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- user_roles (already unique-ish but helpful)
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- customers/suppliers name search prefix
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(lower(name));
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(lower(name));

ANALYZE;

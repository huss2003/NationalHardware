CREATE OR REPLACE FUNCTION public.import_ledger_rows(_table text, _rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare n integer;
begin
  if _table = 'sales_ledger' then
    insert into public.sales_ledger (txn_date, txn_type, vch_no, account_name, debit, credit, narration, source)
    select (r->>'txn_date')::date, r->>'txn_type', r->>'vch_no', coalesce(r->>'account_name',''),
           coalesce((r->>'debit')::numeric,0), coalesce((r->>'credit')::numeric,0), r->>'narration', r->>'source'
    from jsonb_array_elements(_rows) r;
  elsif _table = 'purchase_ledger' then
    insert into public.purchase_ledger (txn_date, txn_type, vch_no, account_name, debit, credit, narration, source)
    select (r->>'txn_date')::date, r->>'txn_type', r->>'vch_no', coalesce(r->>'account_name',''),
           coalesce((r->>'debit')::numeric,0), coalesce((r->>'credit')::numeric,0), r->>'narration', r->>'source'
    from jsonb_array_elements(_rows) r;
  elsif _table = 'cash_transactions' then
    insert into public.cash_transactions (txn_date, txn_type, vch_no, account_name, debit, credit, narration, source)
    select (r->>'txn_date')::date, r->>'txn_type', r->>'vch_no', coalesce(r->>'account_name',''),
           coalesce((r->>'debit')::numeric,0), coalesce((r->>'credit')::numeric,0), r->>'narration', r->>'source'
    from jsonb_array_elements(_rows) r;
  else
    raise exception 'unknown table %', _table;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

GRANT EXECUTE ON FUNCTION public.import_ledger_rows(text, jsonb) TO anon, authenticated, service_role;
-- Every new customer receipt posts into the cash book: cash mode -> cash-in-hand,
-- anything else -> bank. Keeps the day-book and cash/bank ledgers complete.
create or replace function public.tg_receipt_to_cashbook()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cname text;
begin
  select name into cname from public.customers where id = NEW.customer_id;
  insert into public.cash_transactions(txn_date, txn_type, vch_no, account_name, debit, credit, ledger_account, source)
  values (NEW.created_at::date, 'receipt', NEW.receipt_no, coalesce(cname, 'Customer'),
    NEW.amount, 0, case when NEW.mode = 'cash' then 'cash' else 'bank' end, 'app_receipt');
  return NEW;
end $function$;

drop trigger if exists trg_receipt_cashbook on public.receipts;
create trigger trg_receipt_cashbook after insert on public.receipts
  for each row execute function public.tg_receipt_to_cashbook();

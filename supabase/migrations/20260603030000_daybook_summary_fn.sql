-- Day-book summary: opening (cumulative cash before the date), cash in and
-- cash out for the date, per account ('cash' or 'bank'). Closing is opening +
-- in - out, computed by the client.
create or replace function public.daybook_summary(_account text, _date date)
returns table(opening numeric, cash_in numeric, cash_out numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    coalesce(sum(case when txn_date <  _date then debit - credit else 0 end), 0) as opening,
    coalesce(sum(case when txn_date =  _date then debit  else 0 end), 0) as cash_in,
    coalesce(sum(case when txn_date =  _date then credit else 0 end), 0) as cash_out
  from public.cash_transactions
  where ledger_account = _account;
$function$;
grant execute on function public.daybook_summary(text, date) to authenticated;

-- UPI payment accounts for the Sales 2 QR feature. Two VPAs, a default pick,
-- payee name and merchant code. Defaults backfill the single app_settings row.
alter table public.app_settings
  add column if not exists upi_primary_vpa text default 'Vyapar.170232333761@hdfcbank',
  add column if not exists upi_secondary_vpa text default 'Murtuzayusuf@ybl',
  add column if not exists upi_payee_name text default 'Default',
  add column if not exists upi_merchant_code text default '8999',
  add column if not exists upi_default smallint not null default 1;

create index integration_settings_updated_by_idx
  on public.integration_settings (updated_by)
  where updated_by is not null;

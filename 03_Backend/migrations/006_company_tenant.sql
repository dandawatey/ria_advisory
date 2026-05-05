-- 006: add tenant_id to dim_company + assign existing companies
ALTER TABLE dim_company ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- RIA Advisory tenant
UPDATE dim_company
   SET tenant_id = '0bfb1107-b0b5-49fd-821c-b6bea8050dcf'
 WHERE company_name ILIKE '%ria%'
    OR company_name ILIKE '%tmg%'
    OR company_name ILIKE '%synersys%';

-- iSource tenant
UPDATE dim_company
   SET tenant_id = '4e7b2d7a-0137-449b-8b4a-f4f85d83b7b1'
 WHERE company_name ILIKE '%isource%'
    OR company_name ILIKE '%i-source%';

CREATE INDEX IF NOT EXISTS idx_dim_company_tenant ON dim_company(tenant_id);

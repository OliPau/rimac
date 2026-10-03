CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) PRIMARY KEY,
  insured_id CHAR(5) NOT NULL,
  schedule_id BIGINT UNSIGNED NOT NULL,
  country_iso CHAR(2) NOT NULL,
  created_at VARCHAR(30) NOT NULL,
  UNIQUE KEY business_key (insured_id, country_iso, schedule_id)
);

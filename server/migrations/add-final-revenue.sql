-- Adicionar coluna final_revenue à tabela appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS final_revenue INTEGER;
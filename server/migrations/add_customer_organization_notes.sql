-- Add customer_organization column
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_organization TEXT;

-- Add notes column
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
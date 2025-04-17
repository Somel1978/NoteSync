-- Add custom_facilities column to appointments table
ALTER TABLE IF EXISTS appointments 
ADD COLUMN IF NOT EXISTS custom_facilities jsonb DEFAULT '{}'::jsonb;

-- Run migration for any existing custom facility data
-- For existing appointments, convert any custom facilities data from other fields to the new column
WITH appointments_to_update AS (
  SELECT 
    id, 
    COALESCE(cost_breakdown::jsonb->'customFacilities', '{}'::jsonb) AS custom_facilities_data
  FROM 
    appointments
  WHERE 
    cost_breakdown ? 'customFacilities'
)
UPDATE appointments a
SET custom_facilities = u.custom_facilities_data
FROM appointments_to_update u
WHERE a.id = u.id;

-- Print confirmation
SELECT 'Custom facilities column added and data migrated successfully' as message;
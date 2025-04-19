-- Script de migração para adicionar o campo final_revenue na tabela appointments
-- Este campo armazena a receita final confirmada após a conclusão do agendamento

-- Adiciona a coluna final_revenue com valor padrão NULL (caso não seja informado)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS final_revenue INTEGER DEFAULT NULL;

-- Adiciona um novo valor ao enum appointment_status
-- Primeiro verificamos se o valor já existe para evitar erros
DO $$
BEGIN
    -- Verifica se o valor 'finished' já existe no tipo enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'finished' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'appointment_status'
        )
    ) THEN
        -- Se não existir, adiciona o valor ao enum
        ALTER TYPE appointment_status ADD VALUE 'finished' AFTER 'cancelled';
    END IF;
END
$$;

-- Comentários para documentar as colunas
COMMENT ON COLUMN appointments.final_revenue IS 'Receita final confirmada após conclusão do agendamento (em centavos)';
COMMENT ON COLUMN appointments.status IS 'Status do agendamento: pending, approved, rejected, cancelled, finished';

-- Índice para melhorar a performance de consultas por status
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Índice para relatórios financeiros (agendamentos com finalRevenue)
CREATE INDEX IF NOT EXISTS idx_appointments_final_revenue ON appointments(final_revenue) WHERE final_revenue IS NOT NULL;
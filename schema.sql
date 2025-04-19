-- ACRDSC Reservas - SQL Schema
-- Criado em: 17/04/2025

-- Cria tipos de enumeração
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'finished');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'director', 'guest');
    END IF;
END
$$;

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'guest',
    deletion_requested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de Locais
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de Salas
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    description TEXT,
    capacity INTEGER NOT NULL DEFAULT 0,
    flat_rate INTEGER,
    hourly_rate INTEGER,
    attendee_rate INTEGER,
    facilities JSONB DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_rate_type CHECK (
        (flat_rate IS NOT NULL) OR
        (hourly_rate IS NOT NULL) OR
        (attendee_rate IS NOT NULL)
    )
);

-- Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    rooms JSONB,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status appointment_status NOT NULL DEFAULT 'pending',
    purpose TEXT,
    description TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_organization TEXT,
    notes TEXT,
    membership_number TEXT,
    attendees_count INTEGER,
    requested_facilities JSONB,
    custom_facilities JSONB,
    agreed_cost INTEGER,
    final_revenue INTEGER, -- Receita final confirmada após finalização do agendamento
    cost_breakdown JSONB,
    cost_type TEXT,
    order_number INTEGER,
    rejection_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_time_range CHECK (end_time > start_time)
);

-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de Configurações
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de Sessões (para gerenciamento de sessões de usuários)
CREATE TABLE IF NOT EXISTS session (
    sid TEXT PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- Inserir Usuário Administrador Padrão
-- Senha: admin123 (alterada durante a primeira utilização)
INSERT INTO users (username, password, email, name, role)
VALUES (
    'admin',
    '81bc2e6e928c0bec343a248246458023118b25d88271ff80f6f2fc8e3b5f21c4c4981dc9ed2beea7243c6c91cc12079fd18a327e54ab3629f48ad5ec9d869c89.2f3e6c861a5a840ebbb27fd0ea94bada',
    'admin@exemplo.com',
    'Administrador',
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Inserir Configurações Iniciais de Aparência
INSERT INTO settings (key, value)
VALUES (
    'appearance',
    '{"logoText": "ACRDSC", "logoUrl": null, "useLogoImage": false, "title": "ACRDSC Reservas", "subtitle": "Sistema de Reserva de Salas"}'
) ON CONFLICT (key) DO NOTHING;

-- Inserir Configurações Iniciais de Email
INSERT INTO settings (key, value)
VALUES (
    'email',
    '{"enabled": false, "mailjetApiKey": "", "mailjetSecretKey": "", "systemEmail": "sistema@exemplo.com", "systemName": "ACRDSC Reservas", "notifyOnCreate": true, "notifyOnUpdate": true, "notifyOnStatusChange": true, "emailTemplateBookingCreated": "Prezado(a) {customerName},\n\nSua reserva foi criada com sucesso.\n\nDetalhes:\n- Título: {title}\n- Data/Hora: {startTime} até {endTime}\n- Sala: {roomName}\n- Status: {status}\n\nAtenciosamente,\nEquipe ACRDSC", "emailTemplateBookingUpdated": "Prezado(a) {customerName},\n\nSua reserva foi atualizada.\n\nDetalhes:\n- Título: {title}\n- Data/Hora: {startTime} até {endTime}\n- Sala: {roomName}\n- Status: {status}\n\nAtenciosamente,\nEquipe ACRDSC", "emailTemplateBookingStatusChanged": "Prezado(a) {customerName},\n\nO status da sua reserva foi alterado.\n\nDetalhes:\n- Título: {title}\n- Data/Hora: {startTime} até {endTime}\n- Sala: {roomName}\n- Novo Status: {status}\n\nAtenciosamente,\nEquipe ACRDSC"}'
) ON CONFLICT (key) DO NOTHING;

-- Criar Índices para Performance
CREATE INDEX IF NOT EXISTS idx_appointments_room_id ON appointments(room_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_end_time ON appointments(end_time);
CREATE INDEX IF NOT EXISTS idx_rooms_location_id ON rooms(location_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_appointment_id ON audit_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
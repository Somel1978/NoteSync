#!/usr/bin/env node

/**
 * Script para execução em produção usando PM2
 * 
 * Versão simplificada de local-server.js que não faz substituições de arquivos
 * já que isso não é necessário em ambiente de produção.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cores para saída no console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

console.log(`${colors.blue}${colors.bold}=== ACRDSC Reservas - Iniciando em Modo Produção ===${colors.reset}\n`);

// Verificar arquivo .env
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.warn(`${colors.yellow}Arquivo .env não encontrado, criando exemplo...${colors.reset}`);
  
  const envExample = `# Configurações do banco de dados
# Você pode usar uma URL completa de conexão:
DATABASE_URL=postgres://postgres:postgres@localhost:5432/acrdsc_reservas

# Ou especificar os parâmetros individualmente:
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=acrdsc_reservas

# Outras configurações
NODE_ENV=production
SESSION_SECRET=production_secret_key_change_this

# Configurações do Mailjet para envio de emails (opcional)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
`;

  fs.writeFileSync(envPath, envExample);
  console.log(`${colors.green}✓ Arquivo .env de exemplo criado.${colors.reset}`);
  console.log(`${colors.yellow}Por favor, edite o arquivo .env com suas configurações e reinicie o servidor.${colors.reset}`);
  process.exit(1);
}

// Definir o ambiente como produção
process.env.NODE_ENV = 'production';

// Executar o servidor
console.log(`${colors.green}Iniciando servidor em modo produção...${colors.reset}`);
console.log(`${colors.blue}Pressione Ctrl+C para encerrar.${colors.reset}\n`);

// Import e inicialização diretos para ambiente de produção
import('./server/index.js').catch(error => {
  console.error(`${colors.red}Erro ao iniciar o servidor:${colors.reset}`, error);
  process.exit(1);
});
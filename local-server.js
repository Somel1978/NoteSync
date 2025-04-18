#!/usr/bin/env node

/**
 * Script para iniciar o servidor localmente com suporte adequado a variáveis de ambiente
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

console.log(`${colors.blue}${colors.bold}=== ACRDSC Reservas - Iniciando Servidor Local ===${colors.reset}\n`);

// Verificar se o arquivo server/db.local.ts existe
const dbLocalPath = path.join(__dirname, 'server', 'db.local.ts');
const dbOriginalPath = path.join(__dirname, 'server', 'db.ts');
const dbBackupPath = path.join(__dirname, 'server', 'db.ts.bak');

if (!fs.existsSync(dbLocalPath)) {
  console.error(`${colors.red}Erro: Arquivo server/db.local.ts não encontrado!${colors.reset}`);
  console.error(`Verifique se você está executando este script na raiz do projeto.`);
  process.exit(1);
}

// Backup e substituição do arquivo db.ts
try {
  // Criar backup se ainda não existir
  if (!fs.existsSync(dbBackupPath) && fs.existsSync(dbOriginalPath)) {
    console.log(`${colors.yellow}Criando backup de db.ts...${colors.reset}`);
    fs.copyFileSync(dbOriginalPath, dbBackupPath);
  }

  // Substituir db.ts pelo db.local.ts
  console.log(`${colors.yellow}Aplicando configuração de banco de dados local...${colors.reset}`);
  fs.copyFileSync(dbLocalPath, dbOriginalPath);
} catch (error) {
  console.error(`${colors.red}Erro ao manipular arquivos:${colors.reset}`, error);
  process.exit(1);
}

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
NODE_ENV=development
SESSION_SECRET=local_dev_secret_key

# Configurações do Mailjet para envio de emails (opcional)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
`;

  fs.writeFileSync(envPath, envExample);
  console.log(`${colors.green}✓ Arquivo .env de exemplo criado.${colors.reset}`);
  console.log(`${colors.yellow}Por favor, edite o arquivo .env com suas configurações e reinicie este script.${colors.reset}`);
  
  // Restaurar o arquivo db.ts original
  if (fs.existsSync(dbBackupPath)) {
    fs.copyFileSync(dbBackupPath, dbOriginalPath);
  }
  
  process.exit(0);
}

// Executar o servidor
console.log(`${colors.green}Iniciando o servidor...${colors.reset}`);
console.log(`${colors.blue}Pressione Ctrl+C para encerrar.${colors.reset}\n`);

const serverProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

// Restaurar o arquivo original ao encerrar
const cleanup = () => {
  console.log(`\n${colors.yellow}Restaurando configuração original...${colors.reset}`);
  if (fs.existsSync(dbBackupPath)) {
    fs.copyFileSync(dbBackupPath, dbOriginalPath);
    console.log(`${colors.green}Configuração original restaurada.${colors.reset}`);
  }
  process.exit(0);
};

// Registrar handlers para encerramento limpo
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Se o processo do servidor terminar
serverProcess.on('close', (code) => {
  console.log(`${colors.yellow}Servidor encerrado com código ${code}.${colors.reset}`);
  cleanup();
});
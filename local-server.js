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

// Verificar arquivos locais
const dbLocalPath = path.join(__dirname, 'server', 'db.local.ts');
const dbOriginalPath = path.join(__dirname, 'server', 'db.ts');
const dbBackupPath = path.join(__dirname, 'server', 'db.ts.bak');

const viteLocalPath = path.join(__dirname, 'vite.config.local.ts');
const viteOriginalPath = path.join(__dirname, 'vite.config.ts');
const viteBackupPath = path.join(__dirname, 'vite.config.ts.bak');

const viteServerLocalPath = path.join(__dirname, 'server', 'vite.local.ts');
const viteServerOriginalPath = path.join(__dirname, 'server', 'vite.ts');
const viteServerBackupPath = path.join(__dirname, 'server', 'vite.ts.bak');

if (!fs.existsSync(dbLocalPath)) {
  console.error(`${colors.red}Erro: Arquivo server/db.local.ts não encontrado!${colors.reset}`);
  console.error(`Verifique se você está executando este script na raiz do projeto.`);
  process.exit(1);
}

if (!fs.existsSync(viteLocalPath)) {
  console.error(`${colors.red}Erro: Arquivo vite.config.local.ts não encontrado!${colors.reset}`);
  console.error(`Verifique se você está executando este script na raiz do projeto.`);
  process.exit(1);
}

if (!fs.existsSync(viteServerLocalPath)) {
  console.error(`${colors.red}Erro: Arquivo server/vite.local.ts não encontrado!${colors.reset}`);
  console.error(`Verifique se você está executando este script na raiz do projeto.`);
  process.exit(1);
}

// Backup e substituição dos arquivos
try {
  // Backup e substituição de db.ts
  if (!fs.existsSync(dbBackupPath) && fs.existsSync(dbOriginalPath)) {
    console.log(`${colors.yellow}Criando backup de db.ts...${colors.reset}`);
    fs.copyFileSync(dbOriginalPath, dbBackupPath);
  }
  console.log(`${colors.yellow}Aplicando configuração de banco de dados local...${colors.reset}`);
  fs.copyFileSync(dbLocalPath, dbOriginalPath);
  
  // Backup e substituição de vite.config.ts
  if (!fs.existsSync(viteBackupPath) && fs.existsSync(viteOriginalPath)) {
    console.log(`${colors.yellow}Criando backup de vite.config.ts...${colors.reset}`);
    fs.copyFileSync(viteOriginalPath, viteBackupPath);
  }
  console.log(`${colors.yellow}Aplicando configuração de Vite compatível com Node.js v18...${colors.reset}`);
  fs.copyFileSync(viteLocalPath, viteOriginalPath);
  
  // Backup e substituição de server/vite.ts
  if (!fs.existsSync(viteServerBackupPath) && fs.existsSync(viteServerOriginalPath)) {
    console.log(`${colors.yellow}Criando backup de server/vite.ts...${colors.reset}`);
    fs.copyFileSync(viteServerOriginalPath, viteServerBackupPath);
  }
  console.log(`${colors.yellow}Aplicando configuração de server/vite.ts compatível com Node.js v18...${colors.reset}`);
  fs.copyFileSync(viteServerLocalPath, viteServerOriginalPath);
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
  
  // Restaurar os arquivos originais
  if (fs.existsSync(dbBackupPath)) {
    fs.copyFileSync(dbBackupPath, dbOriginalPath);
  }
  
  if (fs.existsSync(viteBackupPath)) {
    fs.copyFileSync(viteBackupPath, viteOriginalPath);
  }
  
  if (fs.existsSync(viteServerBackupPath)) {
    fs.copyFileSync(viteServerBackupPath, viteServerOriginalPath);
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

// Restaurar os arquivos originais ao encerrar
const cleanup = () => {
  console.log(`\n${colors.yellow}Restaurando configurações originais...${colors.reset}`);
  let restored = false;
  
  // Restaurar db.ts
  if (fs.existsSync(dbBackupPath)) {
    fs.copyFileSync(dbBackupPath, dbOriginalPath);
    restored = true;
  }
  
  // Restaurar vite.config.ts
  if (fs.existsSync(viteBackupPath)) {
    fs.copyFileSync(viteBackupPath, viteOriginalPath);
    restored = true;
  }
  
  // Restaurar server/vite.ts
  if (fs.existsSync(viteServerBackupPath)) {
    fs.copyFileSync(viteServerBackupPath, viteServerOriginalPath);
    restored = true;
  }
  
  if (restored) {
    console.log(`${colors.green}Configurações originais restauradas.${colors.reset}`);
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
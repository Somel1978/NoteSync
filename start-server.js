#!/usr/bin/env node

/**
 * Script simplificado para iniciar o servidor via Node.js
 * Funciona tanto com Node.js v18 quanto com v23
 * 
 * Este script:
 * 1. Define NODE_ENV como "production"
 * 2. Usa o tsx diretamente para iniciar o servidor TypeScript
 * 3. Não requer substituição de arquivos
 */

const { spawn } = require('child_process');
const path = require('path');

// Configurar ambiente
process.env.NODE_ENV = 'production';

// Cores para saída no console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

console.log(`${colors.blue}${colors.bold}=== ACRDSC Reservas - Iniciando Servidor de Produção ===${colors.reset}\n`);

// Verificar versão do Node.js
const nodeVersion = process.version;
console.log(`${colors.green}Usando Node.js:${colors.reset} ${nodeVersion}`);

// Usar o tsx diretamente para iniciar o servidor TypeScript
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

// Se o processo do servidor terminar
serverProcess.on('close', (code) => {
  if (code !== 0) {
    console.log(`${colors.red}Servidor encerrado com código ${code}.${colors.reset}`);
  } else {
    console.log(`${colors.green}Servidor encerrado normalmente.${colors.reset}`);
  }
  process.exit(code);
});

// Gerenciar sinais para encerramento limpo
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Recebido SIGINT, encerrando servidor...${colors.reset}`);
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log(`\n${colors.yellow}Recebido SIGTERM, encerrando servidor...${colors.reset}`);
  serverProcess.kill('SIGTERM');
});
#!/usr/bin/env node

/**
 * Script ULTRA simplificado para execução em Replit
 * Minimiza problemas de compatibilidade e dependências
 */

const { execSync } = require('child_process');
const path = require('path');

// Definir ambiente
process.env.NODE_ENV = 'development';

// Cores para saída no console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

console.log(`${colors.blue}${colors.bold}=== ACRDSC Reservas - Inicialização Simplificada ===${colors.reset}\n`);
console.log(`${colors.green}Node.js versão:${colors.reset} ${process.version}`);

// Iniciar servidor usando npx diretamente (mais simples possível)
try {
  console.log(`${colors.yellow}Iniciando servidor...${colors.reset}`);
  execSync('npx tsx server/index.ts', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
} catch (err) {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
}
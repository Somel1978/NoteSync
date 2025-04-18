#!/usr/bin/env node

/**
 * Script para execução em produção usando PM2
 * 
 * Versão simplificada que executa o servidor diretamente.
 */

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

// Definir ambiente como produção
process.env.NODE_ENV = 'production';

// Esta abordagem usa o processo direto
console.log(`${colors.green}Iniciando servidor diretamente sem substituição de arquivos...${colors.reset}`);
console.log(`${colors.blue}Pressione Ctrl+C para encerrar.${colors.reset}\n`);

// Importar e executar o módulo index.js
require('./server/index.js');
#!/usr/bin/env node

/**
 * Script muito simplificado para execução sem npm
 * Funciona diretamente com Node.js (tanto v18 quanto v23)
 */

const { spawn } = require('child_process');

// Definir o ambiente como produção
process.env.NODE_ENV = 'production';

console.log('=== ACRDSC Reservas - Iniciando Servidor ===');
console.log('Node.js version:', process.version);

// Iniciar o servidor usando tsx (que suporta TypeScript)
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env }
});

// Gerenciar o encerramento
process.on('SIGINT', () => {
  console.log('\nEncerrando servidor graciosamente...');
  serverProcess.kill('SIGINT');
});

serverProcess.on('close', (code) => {
  console.log(`Servidor encerrado com código ${code}`);
  process.exit(code);
});
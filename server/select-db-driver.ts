/**
 * Script para selecionar o driver de banco de dados a ser usado
 * Oferece opção entre usar o driver Neon Serverless ou o driver pg padrão
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Necessário para obter __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminhos para os arquivos
const neonDriverPath = path.join(__dirname, 'db.ts');
const pgDriverPath = path.join(__dirname, 'db-pg.ts');
const dbBackupPath = path.join(__dirname, 'db.ts.bak');

// Verifica se os arquivos existem
if (!fs.existsSync(neonDriverPath)) {
  console.error('❌ Erro: O arquivo db.ts não foi encontrado.');
  process.exit(1);
}

if (!fs.existsSync(pgDriverPath)) {
  console.error('❌ Erro: O arquivo db-pg.ts não foi encontrado.');
  process.exit(1);
}

// Cria uma interface para leitura da entrada do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para detectar qual driver está sendo usado atualmente
function detectCurrentDriver(): 'neon' | 'pg' | 'unknown' {
  try {
    const dbContent = fs.readFileSync(neonDriverPath, 'utf8');
    
    if (dbContent.includes('drizzle-orm/neon-serverless')) {
      return 'neon';
    } else if (dbContent.includes('drizzle-orm/node-postgres')) {
      return 'pg';
    } else {
      return 'unknown';
    }
  } catch (error) {
    console.error('❌ Erro ao ler arquivo db.ts:', error);
    return 'unknown';
  }
}

// Função para fazer backup do arquivo atual
function backupCurrentFile() {
  try {
    fs.copyFileSync(neonDriverPath, dbBackupPath);
    console.log('✅ Backup do arquivo db.ts criado como db.ts.bak');
  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
  }
}

// Função para trocar o driver
function switchToDriver(driver: 'neon' | 'pg') {
  try {
    // Primeiro, fazer backup do arquivo atual
    backupCurrentFile();
    
    // Depois, copiar o arquivo escolhido
    if (driver === 'neon') {
      // Como db.ts já é o driver Neon, não precisamos copiá-lo de volta
      console.log('✅ Mantendo o driver Neon Serverless.');
    } else {
      // Copiar o arquivo pg-driver.ts para db.ts
      fs.copyFileSync(pgDriverPath, neonDriverPath);
      console.log('✅ Substituído por driver PostgreSQL padrão.');
    }
    
    console.log('\n🚀 Pronto! Reinicie o servidor (npm run dev) para aplicar as alterações.');
  } catch (error) {
    console.error('❌ Erro ao trocar driver:', error);
  }
}

// Detectar driver atual
const currentDriver = detectCurrentDriver();
console.log('---------------------------------------------');
console.log('🔍 Seletor de Driver de Banco de Dados');
console.log('---------------------------------------------');

if (currentDriver === 'neon') {
  console.log('📊 Driver atual: Neon Serverless (adaptador para produção)');
} else if (currentDriver === 'pg') {
  console.log('📊 Driver atual: PostgreSQL padrão (melhor para desenvolvimento local)');
} else {
  console.log('📊 Driver atual: Não identificado');
}

console.log('\nEscolha qual driver deseja usar:');
console.log('  1. 🌩️  Neon Serverless (recomendado para produção)');
console.log('  2. 🐘 PostgreSQL padrão (recomendado para desenvolvimento local)');
console.log('  3. ❌ Cancelar e sair');

rl.question('\nDigite o número da opção desejada (1-3): ', (answer) => {
  switch (answer.trim()) {
    case '1':
      switchToDriver('neon');
      break;
    case '2':
      switchToDriver('pg');
      break;
    case '3':
      console.log('Operação cancelada. Nenhuma alteração foi feita.');
      break;
    default:
      console.log('Opção inválida. Nenhuma alteração foi feita.');
  }
  
  rl.close();
});
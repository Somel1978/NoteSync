#!/usr/bin/env node

/**
 * Script de configuração para instalação local
 * 
 * Este script verifica se o ambiente está configurado corretamente
 * e fornece instruções para corrigir problemas comuns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

// Obtém o diretório atual para ES modules
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

console.log(`${colors.blue}${colors.bold}=== ACRDSC Reservas - Configuração Local ===${colors.reset}\n`);

// Função para executar comandos como promessa
function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Verificar versão do Node.js
try {
  const version = await execPromise('node --version');
  console.log(`${colors.blue}Versão do Node.js:${colors.reset} ${version}`);
  
  // Verificar se a versão é compatível (v18+)
  const majorVersion = parseInt(version.substring(1).split('.')[0], 10);
  if (majorVersion < 18) {
    console.warn(`${colors.yellow}Aviso: Esta aplicação foi desenvolvida com Node.js v18+. Você está usando v${majorVersion}.${colors.reset}`);
    console.warn(`${colors.yellow}Recomendamos atualizar para a versão mais recente do Node.js.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✓ Versão do Node.js compatível${colors.reset}\n`);
  }
} catch (error) {
  console.error(`${colors.red}Erro ao verificar versão do Node.js${colors.reset}`);
}

// Verificar arquivo .env
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.warn(`${colors.yellow}Arquivo .env não encontrado na raiz do projeto.${colors.reset}`);
  console.log(`${colors.blue}Criando arquivo .env de exemplo...${colors.reset}`);
  
  const envExample = `# Configurações do banco de dados
# Você pode usar uma URL completa de conexão:
DATABASE_URL=postgres://usuario:senha@localhost:5432/acrdsc_reservas

# Ou especificar os parâmetros individualmente:
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=acrdsc_reservas

# Configurações do Mailjet para envio de emails
MAILJET_API_KEY=sua_chave_api_do_mailjet
MAILJET_SECRET_KEY=sua_chave_secreta_do_mailjet

# Outras configurações
NODE_ENV=development
SESSION_SECRET=chave_de_sessao_super_secreta
`;

  fs.writeFileSync(envPath, envExample);
  console.log(`${colors.green}✓ Arquivo .env de exemplo criado. Por favor, edite-o com suas configurações.${colors.reset}\n`);
} else {
  console.log(`${colors.green}✓ Arquivo .env encontrado${colors.reset}`);
  
  // Verificar se contém as variáveis essenciais
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasDatabase = envContent.includes('DATABASE_URL=') || 
                     (envContent.includes('PGHOST=') && 
                      envContent.includes('PGUSER=') && 
                      envContent.includes('PGDATABASE='));
  
  if (!hasDatabase) {
    console.warn(`${colors.yellow}Aviso: Configuração de banco de dados não encontrada no arquivo .env${colors.reset}`);
    console.log(`Adicione as seguintes linhas ao seu arquivo .env:`);
    console.log(`
DATABASE_URL=postgres://usuario:senha@localhost:5432/acrdsc_reservas
# OU
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=acrdsc_reservas
`);
  } else {
    console.log(`${colors.green}✓ Configurações de banco de dados encontradas${colors.reset}\n`);
  }
}

// Verificar PostgreSQL
try {
  const psqlPath = await execPromise('which psql');
  
  if (!psqlPath) {
    console.warn(`${colors.yellow}PostgreSQL CLI (psql) não encontrado no PATH.${colors.reset}`);
    console.warn(`${colors.yellow}Certifique-se de que o PostgreSQL está instalado e configurado corretamente.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✓ PostgreSQL CLI (psql) encontrado: ${psqlPath}${colors.reset}`);
    
    // Verificar se o banco de dados existe
    const envContent = fs.readFileSync(envPath, 'utf8');
    let dbName = 'acrdsc_reservas';
    
    // Tentar extrair o nome do banco de dados do arquivo .env
    const dbUrlMatch = envContent.match(/DATABASE_URL=.*\/([^?]+)/);
    const pgDbMatch = envContent.match(/PGDATABASE=([^\r\n]+)/);
    
    if (dbUrlMatch && dbUrlMatch[1]) {
      dbName = dbUrlMatch[1];
    } else if (pgDbMatch && pgDbMatch[1]) {
      dbName = pgDbMatch[1];
    }
    
    console.log(`${colors.blue}Banco de dados configurado:${colors.reset} ${dbName}\n`);
    
    console.log(`${colors.blue}Para criar o banco de dados (se ainda não existir), execute:${colors.reset}`);
    console.log(`createdb ${dbName}`);
    console.log(`\n${colors.blue}Para aplicar o esquema e migrações:${colors.reset}`);
    console.log(`npm run db:push\n`);
  }
} catch (error) {
  console.warn(`${colors.yellow}PostgreSQL CLI (psql) não encontrado no PATH.${colors.reset}`);
  console.warn(`${colors.yellow}Certifique-se de que o PostgreSQL está instalado e configurado corretamente.${colors.reset}\n`);
}

// Instruções finais
console.log(`${colors.bold}${colors.blue}Próximos passos:${colors.reset}`);
console.log(`1. Edite o arquivo .env com suas configurações`);
console.log(`2. Certifique-se de que o banco de dados PostgreSQL está em execução`);
console.log(`3. Instale as dependências: ${colors.bold}npm install${colors.reset}`);
console.log(`4. Execute as migrações: ${colors.bold}npm run db:push${colors.reset}`);
console.log(`5. Inicie a aplicação: ${colors.bold}npm run dev${colors.reset}\n`);

console.log(`${colors.blue}${colors.bold}Em caso de problemas, verifique:${colors.reset}`);
console.log(`- Se o PostgreSQL está iniciado e acessível`);
console.log(`- Se as credenciais no arquivo .env estão corretas`);
console.log(`- Se você está usando Node.js v18 ou superior`);
console.log(`- Se todos os pacotes foram instalados corretamente (npm install)\n`);

console.log(`${colors.green}${colors.bold}Boa sorte!${colors.reset}`);
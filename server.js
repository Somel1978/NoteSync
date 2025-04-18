#!/usr/bin/env node

/**
 * Script simplificado para execução em produção sem necessidade de sudo
 * Compatível com Node.js v18 e v23
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Definir ambiente como produção
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
console.log(`${colors.green}Node.js versão:${colors.reset} ${process.version}`);

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

// Verificar se TSX está instalado
function startServer() {
  console.log(`${colors.green}Iniciando servidor com tsx...${colors.reset}`);

  // Usar TSX para executar o código TypeScript
  const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  // Gerenciar processo do servidor
  serverProcess.on('error', (err) => {
    console.error(`${colors.red}Erro ao iniciar o servidor:${colors.reset}`, err);
    
    // Tentar executar com compilador TS alternativo se tsx falhar
    console.log(`${colors.yellow}Tentando iniciar com ts-node...${colors.reset}`);
    
    const tsNodeProcess = spawn('npx', ['ts-node', 'server/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    tsNodeProcess.on('error', (err) => {
      console.error(`${colors.red}Erro ao iniciar com ts-node:${colors.reset}`, err);
      process.exit(1);
    });
    
    // Gerenciar encerramento
    process.on('SIGINT', () => {
      console.log(`\n${colors.yellow}Recebido SIGINT, encerrando servidor...${colors.reset}`);
      tsNodeProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      console.log(`\n${colors.yellow}Recebido SIGTERM, encerrando servidor...${colors.reset}`);
      tsNodeProcess.kill('SIGTERM');
    });
    
    tsNodeProcess.on('close', (code) => {
      console.log(`${colors.yellow}Servidor encerrado com código ${code}.${colors.reset}`);
      process.exit(code);
    });
  });

  // Gerenciar encerramento
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Recebido SIGINT, encerrando servidor...${colors.reset}`);
    serverProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log(`\n${colors.yellow}Recebido SIGTERM, encerrando servidor...${colors.reset}`);
    serverProcess.kill('SIGTERM');
  });
  
  serverProcess.on('close', (code) => {
    console.log(`${colors.yellow}Servidor encerrado com código ${code}.${colors.reset}`);
    process.exit(code);
  });
}

// Verificar dependências necessárias
function checkDependencies() {
  const tryInstall = (packageName) => {
    console.log(`${colors.yellow}Instalando ${packageName}...${colors.reset}`);
    try {
      require('child_process').execSync(`npm install --no-save ${packageName}`, {
        stdio: 'inherit'
      });
      return true;
    } catch (error) {
      console.error(`${colors.red}Falha ao instalar ${packageName}${colors.reset}`);
      return false;
    }
  };

  try {
    require.resolve('tsx');
    console.log(`${colors.green}✓ tsx está instalado${colors.reset}`);
    startServer();
  } catch (e) {
    console.log(`${colors.yellow}tsx não encontrado, tentando instalar...${colors.reset}`);
    if (tryInstall('tsx')) {
      startServer();
    } else {
      console.log(`${colors.yellow}Tentando instalar ts-node como alternativa...${colors.reset}`);
      if (tryInstall('ts-node')) {
        startServer();
      } else {
        console.error(`${colors.red}Não foi possível instalar os compiladores TypeScript necessários.${colors.reset}`);
        console.error(`${colors.yellow}Por favor, instale manualmente com:${colors.reset}`);
        console.error(`npm install -g tsx`);
        process.exit(1);
      }
    }
  }
}

// Iniciar verificação de dependências
checkDependencies();
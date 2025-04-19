/**
 * Script para testar conexão direta com PostgreSQL
 * 
 * Este arquivo é usado para verificar problemas de conexão com o banco de dados
 * usando apenas 'pg', sem depender do Drizzle ORM ou outras bibliotecas.
 * 
 * Para executar: tsx server/direct-pg-connect.ts
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Obtém o equivalente a __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Função para carregar manualmente as variáveis de ambiente do arquivo .env
function loadEnvFile() {
  // Lista de possíveis caminhos para o arquivo .env
  const possiblePaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../../../.env')
  ];
  
  let loaded = false;
  
  for (const envPath of possiblePaths) {
    try {
      console.log(`Tentando carregar variáveis de ambiente de: ${envPath}`);
      
      const envContent = readFileSync(envPath, 'utf8');
      const envVars = envContent.split('\n');
      
      envVars.forEach(line => {
        // Ignora linhas vazias e comentários
        if (!line || line.trim() === '' || line.startsWith('#')) {
          return;
        }
        
        const matches = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (matches && matches.length > 2) {
          const key = matches[1];
          let value = matches[2] || '';
          
          // Remove aspas se presentes
          if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            value = value.replace(/^"|"$/g, '');
          }
          
          process.env[key] = value;
        }
      });
      
      console.log(`Variáveis de ambiente carregadas com sucesso de ${envPath}`);
      loaded = true;
      break;
    } catch (error: any) {
      console.error(`Falha ao carregar arquivo .env de ${envPath}: ${error.message}`);
    }
  }
  
  // Se não conseguir carregar o arquivo .env, cria as variáveis com os valores fornecidos no README
  if (!loaded) {
    console.warn('Não foi possível carregar variáveis de ambiente de nenhum arquivo .env.');
    console.warn('Usando variáveis de ambiente fornecidas diretamente no código.');
    
    // Valores de ambiente para desenvolvimento local
    process.env.DATABASE_URL = process.env.DATABASE_URL || 
      `postgres://${process.env.PGUSER || 'acrdscdb'}:${process.env.PGPASSWORD || 'acrdsc00'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'acrdsc_reservas'}`;
    
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'chave_secreta_desenvolvimento_local';
  }
}

// Carrega as variáveis de ambiente antes de qualquer outra operação
loadEnvFile();

// Configuração do banco de dados
let databaseUrl = process.env.DATABASE_URL;

// Se não tiver DATABASE_URL mas tiver as variáveis individuais, construa a URL
if (!databaseUrl && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '5432';
  databaseUrl = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${host}:${port}/${process.env.PGDATABASE}`;
  console.log(`Construindo DATABASE_URL a partir de variáveis individuais: ${databaseUrl}`);
} 
// Se estiver em ambiente de desenvolvimento, use valores padrão
else if (!databaseUrl) {
  // Valores padrão para ambiente local
  const pgUser = 'acrdscdb';
  const pgPassword = 'acrdsc00';
  const pgHost = 'localhost';
  const pgPort = '5432';
  const pgDatabase = 'acrdsc_reservas';
  
  databaseUrl = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
  
  console.log('AVISO: DATABASE_URL ou variáveis individuais PG* não encontradas no ambiente.');
  console.log(`Usando valores padrão para desenvolvimento local: ${databaseUrl}`);
  console.log('Se quiser usar outros valores, crie um arquivo .env na raiz do projeto.');
}

// Parseamos a URL para configurar o pool
const dbConfig = {
  user: process.env.PGUSER || 'acrdscdb',
  password: process.env.PGPASSWORD || 'acrdsc00',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'acrdsc_reservas'
};

console.log("Tentando conectar usando conexão direta com PG usando:");
console.log(`  Host: ${dbConfig.host}`);
console.log(`  Port: ${dbConfig.port}`);
console.log(`  Database: ${dbConfig.database}`);
console.log(`  User: ${dbConfig.user}`);
console.log(`  Password: ${'*'.repeat(dbConfig.password.length)}`);

// Cria uma conexão usando apenas pg, sem Drizzle ou Neon
const pool = new Pool(dbConfig);

// Função para testar a conexão
async function testConnection() {
  try {
    console.log("Tentando executar uma consulta simples...");
    const result = await pool.query('SELECT current_timestamp as time, current_database() as database');
    console.log("✅ Conexão bem-sucedida!");
    console.log(`  Timestamp do servidor: ${result.rows[0].time}`);
    console.log(`  Banco de dados: ${result.rows[0].database}`);
    
    // Tenta obter versão do PostgreSQL para confirmação
    const versionResult = await pool.query('SELECT version()');
    console.log(`  Versão do PostgreSQL: ${versionResult.rows[0].version}`);
    
    return true;
  } catch (error: any) {
    console.error("❌ Erro ao conectar ao banco de dados:", error);
    
    // Diagnóstico mais detalhado
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('password authentication failed')) {
      console.error("  Problema: Credenciais incorretas. Verifique o usuário e senha.");
    } 
    else if (errorMsg.includes('does not exist')) {
      console.error("  Problema: O banco de dados não existe. Execute: createdb acrdsc_reservas");
    }
    else if (errorMsg.includes('ECONNREFUSED')) {
      console.error("  Problema: Não foi possível conectar ao servidor PostgreSQL.");
      console.error("  Verifique se o PostgreSQL está em execução e acessível na porta especificada.");
    }
    else if (errorMsg.includes('role')) {
      console.error("  Problema: O usuário (role) especificado não existe no PostgreSQL.");
      console.error("  Execute: createuser acrdscdb");
    }
    
    return false;
  } finally {
    // Fecha a conexão
    await pool.end();
  }
}

// Execute o teste
testConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error("Erro inesperado:", err);
    process.exit(1);
  });
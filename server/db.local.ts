// ESM versão para Node.js v23+
console.log("===== CARREGANDO server/db.local.ts =====");
console.log("Caminho completo:", import.meta.url);
console.log("Node.js version:", process.version);

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega o arquivo .env manualmente
function loadEnvFile() {
  try {
    // Obtém o diretório atual usando ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Tenta encontrar o arquivo .env no diretório atual e nos diretórios pais
    let currentDir = __dirname;
    
    // Limita a busca a alguns diretórios pais para evitar loop infinito
    for(let i = 0; i < 5; i++) {
      const envPath = path.join(currentDir, '.env');
      
      if (fs.existsSync(envPath)) {
        console.log(`Arquivo .env encontrado em: ${envPath}`);
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        // Processa e carrega cada linha como variável de ambiente
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          const trimmedLine = line.trim();
          
          // Ignora comentários e linhas vazias
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const equalSignPos = trimmedLine.indexOf('=');
            
            if (equalSignPos > 0) {
              const key = trimmedLine.substring(0, equalSignPos).trim();
              const value = trimmedLine.substring(equalSignPos + 1).trim()
                // Remove aspas ao redor do valor, se houver
                .replace(/^["'](.*)["']$/, '$1');
              
              // Define a variável de ambiente se ela ainda não existir
              if (!process.env[key]) {
                process.env[key] = value;
                console.log(`Definida variável de ambiente: ${key}=****`);
              }
            }
          }
        }
        
        return true;
      }
      
      // Sobe um nível na árvore de diretórios
      currentDir = path.dirname(currentDir);
    }
    
    console.warn("Arquivo .env não encontrado nos diretórios pais.");
    return false;
  } catch (error) {
    console.error("Erro ao carregar arquivo .env:", error);
    return false;
  }
}

// Tenta carregar o arquivo .env
loadEnvFile();

// Configurações de conexão
const connectionConfig: any = {};

if (process.env.DATABASE_URL) {
  connectionConfig.connectionString = process.env.DATABASE_URL;
  console.log("Usando configuração via DATABASE_URL");
} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
  connectionConfig.host = process.env.PGHOST;
  connectionConfig.port = parseInt(process.env.PGPORT || '5432');
  connectionConfig.user = process.env.PGUSER;
  connectionConfig.password = process.env.PGPASSWORD;
  connectionConfig.database = process.env.PGDATABASE;
  connectionConfig.ssl = false; // Desabilita SSL para conexões locais
  console.log("Usando configuração via variáveis individuais PG*");
} else {
  connectionConfig.host = 'localhost';
  connectionConfig.port = 5432;
  connectionConfig.user = 'postgres';
  connectionConfig.password = 'postgres';
  connectionConfig.database = 'acrdsc_reservas';
  connectionConfig.ssl = false;
  console.log("AVISO: Usando valores padrão para conexão local");
}

console.log("Configurações de banco:", JSON.stringify({
  ...connectionConfig, 
  password: connectionConfig.password ? '***' : undefined
}));

// Criar pool e conexão
console.log("Criando pool de conexão local...");
export const pool = new Pool(connectionConfig);

// Testar conexão
pool.query('SELECT NOW()').then(result => {
  console.log("Conexão com banco de dados local estabelecida com sucesso!");
  console.log("Timestamp do servidor:", result.rows[0].now);
}).catch(error => {
  console.error("ERRO ao conectar ao banco de dados:", error.message);
  console.error("Verifique suas credenciais e configurações no arquivo .env");
  process.exit(1);
});

// Criar instância drizzle
console.log("Inicializando ORM local...");
export const db = drizzle(pool, { schema });
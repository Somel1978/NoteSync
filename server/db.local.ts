import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega o arquivo .env manualmente
// Essa função encontra e carrega o arquivo .env manualmente
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

// Configuração para o cliente neon serverless
neonConfig.webSocketConstructor = ws;

// Imprime as variáveis de ambiente relacionadas ao banco de dados (sem mostrar senhas)
console.log("Variáveis de ambiente disponíveis:");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "***" : "não definido");
console.log("PGHOST:", process.env.PGHOST || "não definido");
console.log("PGPORT:", process.env.PGPORT || "não definido");
console.log("PGUSER:", process.env.PGUSER || "não definido");
console.log("PGDATABASE:", process.env.PGDATABASE || "não definido");
console.log("PGPASSWORD:", process.env.PGPASSWORD ? "***" : "não definido");

// Tenta usar DATABASE_URL, caso contrário usa as variáveis PGXXX individuais
let connectionConfig: any = {};

if (process.env.DATABASE_URL) {
  connectionConfig.connectionString = process.env.DATABASE_URL;
  console.log("Usando configuração via DATABASE_URL");
} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
  connectionConfig = {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  };
  console.log("Usando configuração via variáveis individuais PG*");
} else {
  // Como último recurso, tenta usar valores padrão para desenvolvimento local
  connectionConfig = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'acrdsc_reservas',
  };
  console.log("AVISO: Usando valores padrão para conexão local pois nenhuma variável de ambiente foi definida!");
  console.log("Tentando conectar com:", {
    ...connectionConfig, 
    password: '****'
  });
}

// Cria o pool de conexões e instância do Drizzle
export const pool = new Pool(connectionConfig);

// Teste de conexão ao iniciar
pool.query('SELECT NOW()')
  .then(result => {
    console.log('Conexão com o banco de dados estabelecida com sucesso!');
    console.log('Timestamp do servidor:', result.rows[0].now);
  })
  .catch(err => {
    console.error('ERRO ao conectar ao banco de dados:', err.message);
    console.error('Verifique suas credenciais e configurações no arquivo .env');
  });

export const db = drizzle({ client: pool, schema });
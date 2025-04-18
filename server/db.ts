// Versão compatível com ES modules para ambos ambientes (online e local)
console.log("===== CARREGANDO server/db.ts PADRÃO =====");
console.log("Caminho completo:", import.meta.url);
console.log("Node.js version:", process.version);

// Importações para ambiente online
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configuração Neon para ambiente online
neonConfig.webSocketConstructor = ws;

// Configurações de conexão
const connectionConfig = {};

if (process.env.DATABASE_URL) {
  connectionConfig.connectionString = process.env.DATABASE_URL;
  console.log("Usando configuração via DATABASE_URL");
} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
  connectionConfig.host = process.env.PGHOST;
  connectionConfig.port = parseInt(process.env.PGPORT || '5432');
  connectionConfig.user = process.env.PGUSER;
  connectionConfig.password = process.env.PGPASSWORD;
  connectionConfig.database = process.env.PGDATABASE;
  console.log("Usando configuração via variáveis individuais PG*");
} else {
  throw new Error(
    "DATABASE_URL ou variáveis PGHOST, PGUSER, PGDATABASE devem estar configuradas. Verifique seu arquivo .env"
  );
}

console.log("Configurações de banco:", JSON.stringify({
  ...connectionConfig, 
  password: connectionConfig.password ? '***' : undefined
}));

// Criação do pool e db usando a importação direta
export const pool = new Pool(connectionConfig);
export const db = drizzle(pool, { schema });
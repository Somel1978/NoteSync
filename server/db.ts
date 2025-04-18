import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import * as path from 'path';

// O arquivo .env é carregado automaticamente pelo framework ou
// durante a inicialização do servidor

neonConfig.webSocketConstructor = ws;

// Tenta usar DATABASE_URL, caso contrário usa as variáveis PGXXX individuais
let connectionConfig: any = {};

if (process.env.DATABASE_URL) {
  connectionConfig.connectionString = process.env.DATABASE_URL;
} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
  connectionConfig = {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  };
} else {
  throw new Error(
    "DATABASE_URL ou variáveis PGHOST, PGUSER, PGPASSWORD, PGDATABASE devem estar configuradas. Verifique seu arquivo .env"
  );
}

console.log("Conectando ao banco de dados com as configurações:", 
  JSON.stringify({...connectionConfig, password: connectionConfig.password ? '***' : undefined}));

export const pool = new Pool(connectionConfig);
export const db = drizzle({ client: pool, schema });

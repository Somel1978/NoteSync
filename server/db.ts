import * as schema from "@shared/schema";
import { log } from "./vite";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from 'ws';

// Verifica o ambiente para decidir qual conexão usar
const isLocalEnvironment = process.env.NODE_ENV === 'development';

// Configuração do banco de dados
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Configure this in your .env file.",
  );
}

// Configuração para Neon serverless (usar mesmo em desenvolvimento por simplicidade)
neonConfig.webSocketConstructor = ws;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Log da configuração
if (isLocalEnvironment) {
  log('Usando configuração de banco de dados para ambiente de desenvolvimento');
} else {
  log('Usando configuração de banco de dados para ambiente de produção');
}

// Teste a conexão
pool.query('SELECT 1')
  .then(() => log('Conexão com banco de dados estabelecida com sucesso'))
  .catch((err) => log(`Erro ao conectar ao banco de dados: ${err.message}`));

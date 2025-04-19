import * as schema from "@shared/schema";
import { log } from "./vite";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from 'ws';

// Verifica o ambiente para decidir qual conexão usar
const isLocalEnvironment = process.env.NODE_ENV === 'development';

// Configuração do banco de dados
let databaseUrl = process.env.DATABASE_URL;

// Se não tiver DATABASE_URL mas tiver as variáveis individuais, construa a URL
if (!databaseUrl && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '5432';
  databaseUrl = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${host}:${port}/${process.env.PGDATABASE}`;
  console.log(`Construindo DATABASE_URL a partir de variáveis individuais: ${databaseUrl}`);
} else if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL ou as variáveis PGUSER, PGPASSWORD, PGHOST, PGPORT e PGDATABASE devem ser configuradas no arquivo .env",
  );
}

// Configuração para Neon serverless (usar mesmo em desenvolvimento por simplicidade)
neonConfig.webSocketConstructor = ws;
export const pool = new Pool({ connectionString: databaseUrl });
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

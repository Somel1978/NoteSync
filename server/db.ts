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
} 
// Se estiver em ambiente de desenvolvimento, use valores padrão
else if (!databaseUrl && isLocalEnvironment) {
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
// Caso contrário, exiba o erro
else if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL ou as variáveis PGUSER, PGPASSWORD, PGHOST, PGPORT e PGDATABASE devem ser configuradas no arquivo .env",
  );
}

// Configura o Neon para funcionar em todos ambientes
neonConfig.webSocketConstructor = ws;

// Em ambiente de desenvolvimento, adiciona configurações para conexão local
if (isLocalEnvironment) {
  // A biblioteca Neon pode trabalhar com conexões diretas também
  // Configurações adicionais para melhorar performance local
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
  log('Ajustando configurações do Neon para PostgreSQL local');
}

// Inicializa a conexão usando o driver do Neon em todos ambientes por simplicidade
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
  .catch((err) => {
    log(`Erro ao conectar ao banco de dados: ${err.message}`);
    log(`Tentou conectar usando DATABASE_URL: ${databaseUrl.replace(/:[^:]*@/, ':****@')}`); // Mascara a senha
    
    // Verifica problemas comuns
    if (err.message.includes('password authentication failed')) {
      log('Problema: credenciais incorretas. Verifique o usuário e senha do banco de dados.');
    } 
    else if (err.message.includes('database') && err.message.includes('does not exist')) {
      log('Problema: o banco de dados não existe. Execute "createdb acrdsc_reservas" para criá-lo.');
    }
    else if (err.message.includes('connect ECONNREFUSED')) {
      log('Problema: não foi possível conectar ao servidor PostgreSQL. Verifique se o PostgreSQL está em execução.');
    }
  });

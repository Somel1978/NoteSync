// ESM versão compatível com Node.js v18
console.log("===== CARREGANDO server/db.ts PADRÃO =====");
console.log("Caminho completo:", import.meta.url);
console.log("Node.js version:", process.version);

// Usando importação dinâmica para resolver o problema com o módulo pg
let pool;
let db;

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

// Exportações iniciais (serão substituídas após inicialização)
export { pool, db };

// Inicializar de forma assíncrona
async function init() {
  try {
    console.log("Inicializando módulos de banco de dados...");
    
    // Importar pg usando dynamic import
    const pg = await import('pg');
    
    // Importar drizzle usando dynamic import
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import("@shared/schema");

    // Criar pool e conexão
    console.log("Criando pool de conexão...");
    pool = new pg.Pool(connectionConfig);
    
    // Criar instância drizzle
    console.log("Inicializando ORM...");
    db = drizzle(pool, { schema });

    console.log("Banco de dados inicializado com sucesso!");
  } catch (error) {
    console.error("ERRO AO INICIALIZAR BANCO DE DADOS:", error);
    process.exit(1);
  }
}

// Iniciar processo de inicialização
init().catch(error => {
  console.error("Falha na inicialização:", error);
  process.exit(1);
});
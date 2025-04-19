// Carrega variáveis de ambiente do arquivo .env
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
      `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'acrdsc_reservas'}`;
    
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'chave_secreta_desenvolvimento_local';
  }
}

// Carrega as variáveis de ambiente antes de qualquer outra operação
loadEnvFile();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 500) {
        logLine = logLine.slice(0, 499) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

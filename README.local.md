# Instalação Local do ACRDSC Reservas

Este guia fornecerá instruções para instalar e executar o sistema ACRDSC Reservas localmente.

## Requisitos

- PostgreSQL 14+
- Node.js (v18.0+ ou v23.0+)

## Passos para Instalação

### 1. Preparar o Banco de Dados

1. Instale o PostgreSQL (caso não tenha):
   ```bash
   # Ubuntu
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # macOS (usando Homebrew)
   brew install postgresql
   ```

2. Crie um banco de dados para o sistema:
   ```bash
   sudo -u postgres createdb acrdsc_reservas
   ```

3. Importe o esquema inicial:
   ```bash
   sudo -u postgres psql -d acrdsc_reservas -f schema.sql
   ```

   Ou se preferir se autenticar diretamente:
   ```bash
   psql -h localhost -U seu_usuario -d acrdsc_reservas -f schema.sql
   ```

### 2. Configurar o Ambiente

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/acrdsc-reservas.git
   cd acrdsc-reservas
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente copiando o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```
   
4. Edite o arquivo `.env` com suas informações de banco de dados e outras configurações.

### 3. Executar o Sistema

#### Modo de Desenvolvimento

Para iniciar o sistema em modo de desenvolvimento com suporte a hot-reload:

```bash
node local-server.js
```

**IMPORTANTE**: Se estiver usando Node.js v23+, o script `local-server.js` já está configurado para lidar com as diferenças na importação de módulos entre v18 e v23.

Caso receba algum erro relacionado ao módulo 'pg', você pode executar o script especificando o caminho completo para o Node.js v23:

```bash
/caminho/completo/para/node23 local-server.js
```

#### Modo de Produção com PM2

Para executar o sistema em produção usando PM2 (recomendado para ambientes de produção):

1. Instale o PM2 globalmente se ainda não tiver instalado:
   ```bash
   npm install -g pm2
   ```

2. Execute o script de configuração de produção (isso também instala o PM2 se necessário):
   ```bash
   ./setup-production.sh
   ```

3. Inicie o servidor usando PM2:
   ```bash
   pm2 start ecosystem.config.js
   ```

4. Configuração para inicialização automática após reboot:
   ```bash
   pm2 startup
   pm2 save
   ```

5. Comandos úteis do PM2:
   ```bash
   # Ver logs da aplicação
   pm2 logs acrdsc-reservas

   # Reiniciar aplicação
   pm2 restart acrdsc-reservas

   # Parar aplicação
   pm2 stop acrdsc-reservas

   # Ver status
   pm2 status
   ```

**OBS**: O modo de produção com PM2 usa o script `production-server.js` que não requer nenhuma substituição de arquivos, tornando-o mais adequado para ambientes de produção.

## Solução de Problemas

### Erro de conexão com o banco de dados

Se você encontrar erros de conexão com o banco de dados, verifique:

1. As credenciais no arquivo `.env`
2. Se o PostgreSQL está em execução:
   ```bash
   # Ubuntu
   sudo systemctl status postgresql
   
   # macOS
   brew services list
   ```

### Erro ao importar módulos ESM

Se encontrar erros relacionados a importações ESM como:

```
SyntaxError: The requested module 'pg' does not provide an export named 'Pool'
```

Isso pode ocorrer com o Node.js v23+. O script `local-server.js` deve lidar com isso automaticamente, mas se necessário, você pode editar manualmente os arquivos `server/db.ts` e `server/db.local.ts` para usar:

```javascript
// Ao invés de:
import { Pool } from 'pg';

// Use:
import pg from 'pg';
const { Pool } = pg;
```

## Acessando o Sistema

Após a inicialização bem-sucedida, o sistema estará disponível em:

- Interface de usuário: http://localhost:5000
- API: http://localhost:5000/api

## Uso Local do Sistema

Para fins de desenvolvimento e teste, o sistema vem com um usuário administrador padrão:

- **Usuário**: admin
- **Senha**: admin

Certifique-se de alterar esta senha ao usar o sistema em um ambiente de produção.
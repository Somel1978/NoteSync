# Guia Detalhado de Instalação Local

Este guia fornece instruções detalhadas para instalação e configuração do ACRDSC Reservas em um ambiente local.

## Pré-requisitos

Antes de iniciar a instalação, certifique-se de que seu sistema atende aos seguintes requisitos:

- **Node.js**: v18.0.0 ou superior (recomendado: v20.6.0+)
- **PostgreSQL**: v15.0 ou superior
- **NPM**: v9.0.0 ou superior
- **Git**: Qualquer versão recente

### Verificando Versões Instaladas

```bash
# Verificar versão do Node.js
node --version

# Verificar versão do NPM
npm --version

# Verificar versão do PostgreSQL
psql --version
```

## Passo a Passo para Instalação

### 1. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/acrdsc-reservas.git
cd acrdsc-reservas
```

### 2. Executar o Script de Configuração

Primeiro, execute o script de configuração que ajudará a identificar qualquer problema com o ambiente:

```bash
node setup.js
```

Este script irá:
- Verificar se a versão do Node.js é compatível
- Criar um arquivo `.env` de exemplo (se não existir)
- Verificar a instalação do PostgreSQL
- Fornecer orientações personalizadas baseadas no seu ambiente

### 3. Configurar o Banco de Dados PostgreSQL

#### 3.1 Instalação do PostgreSQL (se ainda não estiver instalado)

**No Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**No macOS (com Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**No Windows:**
Baixe e instale o PostgreSQL a partir do site oficial: https://www.postgresql.org/download/windows/

#### 3.2 Criar o Banco de Dados

```bash
# Acessar o PostgreSQL como superusuário
sudo -u postgres psql

# No prompt do PostgreSQL, criar um usuário (se necessário)
CREATE USER seu_usuario WITH PASSWORD 'sua_senha';

# Criar o banco de dados
CREATE DATABASE acrdsc_reservas OWNER seu_usuario;

# Sair do prompt do PostgreSQL
\q
```

Alternativamente, se você já tem um usuário configurado:
```bash
createdb acrdsc_reservas
```

#### 3.3 Importar o Esquema do Banco de Dados

Existem três métodos para importar o esquema:

**Método 1**: Conectar diretamente ao PostgreSQL e executar o script:
```bash
# Primeiro conectar ao PostgreSQL
psql -h localhost -U seu_usuario -d acrdsc_reservas

# Quando estiver no prompt do psql, executar o comando:
\i schema.sql

# Para sair após a importação:
\q
```

**Método 2**: Importar o esquema diretamente com um único comando:
```bash
psql -h localhost -U seu_usuario -d acrdsc_reservas -f schema.sql
```

**Método 3**: Usar o Drizzle ORM (se preferir):
```bash
npm run db:push
```

> **Notas importantes**: 
> - Substituir `seu_usuario` pelo seu nome de usuário PostgreSQL
> - Se receber erro de autenticação, adicione a opção `-W` para solicitar a senha: `psql -h localhost -U seu_usuario -W -d acrdsc_reservas`
> - O arquivo schema.sql precisa estar no diretório onde o comando está sendo executado

### 4. Configurar Variáveis de Ambiente

Edite o arquivo `.env` criado pelo script de configuração:

```env
# Configuração do Banco de Dados - escolha uma das abordagens:

# Opção 1: URL completa de conexão
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/acrdsc_reservas

# Opção 2: Parâmetros individuais
PGHOST=localhost
PGPORT=5432
PGUSER=seu_usuario
PGPASSWORD=sua_senha
PGDATABASE=acrdsc_reservas

# Configuração de Segurança
SESSION_SECRET=um_segredo_muito_seguro_para_suas_sessoes

# Configuração do Mailjet (para envio de emails)
MAILJET_API_KEY=sua_api_key_mailjet
MAILJET_SECRET_KEY=sua_secret_key_mailjet
```

**Observações importantes:**
- Se você não pretende usar a funcionalidade de email, pode deixar as chaves do Mailjet em branco
- O `SESSION_SECRET` deve ser uma string aleatória e única para garantir a segurança das sessões
- Você pode usar qualquer um dos formatos de configuração do banco de dados (URL completa ou parâmetros individuais)

### 5. Instalar Dependências

```bash
npm install
```

### 6. Iniciar a Aplicação

Existem duas maneiras de iniciar a aplicação:

**Método 1 (Recomendado para Ambiente Local)**:
```bash
node local-server.js
```
Este script especial:
- Verifica e cria o arquivo .env se necessário
- Configura automaticamente a conexão com o banco de dados
- Inicia o servidor em modo de desenvolvimento
- Garante que as variáveis de ambiente sejam carregadas corretamente

**Método 2 (Padrão)**:
```bash
npm run dev
```

Após iniciar o servidor, você deve poder acessar a aplicação em:
http://localhost:3000

## Solução de Problemas Comuns

### Problema: Erro `The "paths[0]" argument must be of type string` 

Este erro está relacionado ao arquivo `vite.config.ts` e ocorre com versões mais antigas do Node.js.

**Solução**: Certifique-se de estar usando Node.js v18+ (idealmente v20.6+). O projeto usa recursos modernos do JavaScript que requerem uma versão recente do Node.js.

```bash
# Verificar versão atual
node --version

# Atualizar Node.js (exemplo com nvm)
nvm install 20
nvm use 20
```

### Problema: Erro "DATABASE_URL must be set"

**Solução recomendada**:
Use o script especial criado para resolver problemas de variáveis de ambiente:
```bash
node local-server.js
```

**Soluções alternativas**:
1. Verifique se o arquivo `.env` está na raiz do projeto (não em alguma subpasta)
2. Confirme que as variáveis de ambiente estão formatadas corretamente (sem espaços extras)
3. Tente usar o formato de parâmetros individuais (PGHOST, PGUSER, etc.) em vez da URL completa
4. Passe as variáveis diretamente no comando:
   ```bash
   PGHOST=localhost PGUSER=seu_usuario PGPASSWORD=sua_senha PGDATABASE=acrdsc_reservas npm run dev
   ```

### Problema: Erro de Conexão com o PostgreSQL

**Possíveis soluções**:
1. Verifique se o PostgreSQL está em execução:
   ```bash
   # No Linux
   sudo systemctl status postgresql
   
   # No macOS
   brew services list
   ```

2. Teste a conexão diretamente:
   ```bash
   psql -U seu_usuario -h localhost -d acrdsc_reservas
   ```

3. Verifique as configurações de autenticação do PostgreSQL (pg_hba.conf)

### Problema: Erros com pacotes npm ou módulos não encontrados

**Solução**:
1. Limpe o cache do npm:
   ```bash
   npm cache clean --force
   ```

2. Remova a pasta node_modules e reinstale:
   ```bash
   rm -rf node_modules
   npm install
   ```

## Usando a Aplicação Localmente

### Credenciais Padrão

Após a instalação, você pode fazer login com as credenciais padrão:

- **Administrador**:
  - Usuário: `admin`
  - Senha: `admin123`

- **Diretor**:
  - Usuário: `diretor`
  - Senha: `diretor123`

- **Convidado**:
  - Usuário: `convidado`
  - Senha: `convidado123`

**IMPORTANTE**: Por razões de segurança, altere estas senhas após o primeiro login!

### Principais URLs

- **Interface Pública**: http://localhost:3000/
- **Login**: http://localhost:3000/auth
- **Dashboard Admin**: http://localhost:3000/dashboard
- **Reservas**: http://localhost:3000/reservas

## Atualizações e Manutenção

### Atualizar o Código

```bash
git pull
npm install
npm run db:push # Para aplicar alterações no esquema do banco de dados
```

### Backup do Banco de Dados

É recomendável fazer backups regulares do banco de dados:

```bash
pg_dump -U seu_usuario -d acrdsc_reservas > backup_$(date +%Y%m%d).sql
```

## Suporte

Se você encontrar problemas que não estão cobertos neste guia, considere:

1. Verificar o arquivo README.md para instruções gerais
2. Rever as mensagens de erro para pistas específicas
3. Executar `node setup.js` para diagnóstico do ambiente
4. Contatar o time de desenvolvimento para suporte adicional
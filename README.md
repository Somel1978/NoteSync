# ACRDSC Reservas - Sistema de Reserva de Salas

Um sistema completo para gerenciamento de reservas e agendamentos de salas, com cálculo inteligente de preços e gestão avançada de recursos.

## Requisitos do Sistema

- Node.js 18.x ou superior
- PostgreSQL 15.x ou superior
- NPM 9.x ou superior

## Configuração Inicial

### 1. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/acrdsc-reservas.git
cd acrdsc-reservas
```

### 2. Instalar Dependências

```bash
npm install
```

Para executar o projeto localmente, também é necessário instalar o pacote `pg`:

```bash
npm install pg @types/pg --save
```

### 3. Configurar o Banco de Dados

#### Criar banco de dados PostgreSQL

```bash
createdb acrdsc_reservas
```

#### Importar o esquema inicial

O arquivo `schema.sql` contém todas as tabelas e dados iniciais necessários:

```bash
psql -d acrdsc_reservas -f schema.sql
```

### 4. Configurar Variáveis de Ambiente

O sistema tem valores padrão que funcionam em ambiente de desenvolvimento local sem nenhuma configuração adicional:

- **PGUSER**: `acrdscdb`
- **PGPASSWORD**: `acrdsc00`
- **PGHOST**: `localhost`
- **PGPORT**: `5432`
- **PGDATABASE**: `acrdsc_reservas`

Se você precisar de uma configuração diferente, crie um arquivo `.env` na raiz do projeto:

```env
# Configuração do Banco de Dados
# Você pode usar apenas a DATABASE_URL ou as variáveis individuais, o sistema suporta ambos
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/acrdsc_reservas

# Ou então use estas variáveis individuais (que serão automaticamente combinadas)
PGUSER=seu_usuario
PGPASSWORD=sua_senha
PGDATABASE=acrdsc_reservas
PGHOST=localhost
PGPORT=5432

# Configuração de Segurança
SESSION_SECRET=um_segredo_muito_seguro_para_suas_sessoes

# Configuração do Mailjet (para envio de emails)
MAILJET_API_KEY=sua_api_key_mailjet
MAILJET_SECRET_KEY=sua_secret_key_mailjet
```

> **Importante**: O sistema procura por um arquivo `.env` em vários locais possíveis. Se o arquivo não for encontrado, valores padrão serão usados para ambiente de desenvolvimento. A ordem de prioridade é:
> 1. Variáveis definidas no ambiente do sistema operacional
> 2. Variáveis definidas no arquivo `.env`
> 3. Valores padrão codificados para ambiente de desenvolvimento

## Scripts Disponíveis

O projeto inclui vários scripts NPM úteis para desenvolvimento e produção:

- `npm run dev`: Inicia o servidor em modo de desenvolvimento com hot reload
- `npm run build`: Compila o código TypeScript para produção
- `npm start`: Inicia o servidor em modo de produção
- `npm run db:push`: Atualiza o esquema do banco de dados usando Drizzle ORM
- `npm run db:studio`: Inicia o Drizzle Studio para visualização e edição do banco de dados

## Estrutura do Projeto

```
/
├── client/              # Código frontend (React)
│   ├── src/             # Arquivos fonte do frontend
│   ├── public/          # Recursos estáticos
│   └── ...
├── server/              # Código backend (Node.js/Express)
│   ├── routes/          # Rotas da API
│   ├── db.ts            # Configuração do banco de dados
│   ├── storage.ts       # Camada de acesso a dados
│   └── ...
├── shared/              # Código compartilhado entre frontend e backend
│   └── schema.ts        # Esquema do banco de dados (Drizzle ORM)
├── schema.sql           # Esquema SQL inicial para importação
└── ...
```

## Funcionalidades Principais

- **Gestão de Usuários**: Suporte para diferentes níveis de acesso (Admin, Diretor, Convidado)
- **Reserva de Salas**: Interface intuitiva para agendamento de salas
- **Cálculo de Preços**: Suporte a diferentes modelos de preços (por hora, preço fixo, por participante)
- **Dashboard Administrativo**: Estatísticas e visualizações de uso das salas
- **Notificações por Email**: Sistema automático de notificações para reservas
- **Internacionalização**: Suporte multilíngue (Português, Inglês, Espanhol)

## Personalizações Avançadas

### Configuração de Email

O sistema utiliza Mailjet para envio de emails. As configurações podem ser ajustadas em:
- `server/utils/email.ts` - Para a lógica de envio de emails
- Painel administrativo - Para templates de emails (após login como admin)

### Configurações Visuais

O sistema permite personalização da aparência através do painel de administração, incluindo:
- Logo
- Cores principais
- Texto de cabeçalho e rodapé

## Solução de Problemas

### Problemas de Conexão com o Banco de Dados

Se você encontrar erros de conexão com o banco de dados, o aplicativo mostrará mensagens detalhadas no console para ajudar a diagnosticar o problema. Aqui estão as etapas detalhadas para resolver problemas comuns:

#### 1. Verificar se o PostgreSQL está instalado e em execução

Ubuntu/Debian:
```bash
sudo systemctl status postgresql
# Se não estiver rodando:
sudo systemctl start postgresql
```

macOS (com Homebrew):
```bash
brew services list
# Se não estiver rodando:
brew services start postgresql
```

Windows:
- Verifique o "Gerenciador de Serviços" e procure por "PostgreSQL"
- Alternativa: Verifique na bandeja do sistema se há um ícone do PostgreSQL

#### 2. Verificar/criar o banco de dados

```bash
# Conectar ao PostgreSQL 
psql -U postgres

# No prompt do PostgreSQL, verifique se o banco existe
\l

# Se não existir, saia (com \q) e crie o banco de dados
createdb -U postgres acrdsc_reservas

# Se seu usuário não tiver permissão, crie o banco como administrador
sudo -u postgres createdb acrdsc_reservas
```

#### 3. Verificar/criar o usuário do banco de dados

Se estiver usando as configurações padrão (`acrdscdb` / `acrdsc00`), execute:

```bash
# Conecte como usuário postgres
sudo -u postgres psql

# No prompt do psql, crie o usuário
CREATE USER acrdscdb WITH PASSWORD 'acrdsc00';

# Dê permissões ao usuário
GRANT ALL PRIVILEGES ON DATABASE acrdsc_reservas TO acrdscdb;

# Saia do psql
\q
```

#### 4. Configurar o arquivo .env (se as credenciais padrão não funcionarem)

```
# Crie o arquivo .env na raiz do projeto
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/acrdsc_reservas
```

#### 5. Outros problemas específicos

- **Erro "psql: erro: connection to server on socket... failed"**: O PostgreSQL não está executando
- **Erro "password authentication failed"**: Senha incorreta no arquivo `.env`
- **Erro "database does not exist"**: Execute o comando para criar o banco de dados
- **Erro "role does not exist"**: O usuário especificado não existe no PostgreSQL

#### Configuração para Ambiente Local vs. Neon Serverless

O sistema está configurado para usar o PostgreSQL tanto em ambiente local quanto em produção:

- **Desenvolvimento local**: O sistema detecta automaticamente que está em ambiente de desenvolvimento (`NODE_ENV=development`) e ajusta as configurações para trabalhar com PostgreSQL local:
  - Desativa recursos específicos do Neon (como pipeline TLS)
  - Usa valores padrão de conexão se não encontrar configurações explícitas
  - Fornece mensagens detalhadas para diagnóstico de erros

- **Produção**: Quando em ambiente de produção (`NODE_ENV=production`), o sistema:
  - Ativa todos os recursos do Neon Serverless para otimização de conexão
  - Requer configuração explícita das variáveis de ambiente
  - Minimiza o log e mensagens de depuração

Para funcionar em ambos os ambientes, o sistema usa o driver Neon (que é compatível com PostgreSQL padrão) com configurações diferentes.

O código que gerencia essa configuração está em `server/db.ts`.

### Execução em Ambiente Local

Para executar o projeto localmente:

1. Execute `npm run dev` para iniciar em modo de desenvolvimento
2. O servidor estará disponível em `http://localhost:5000`
3. A página inicial pública não requer login
4. Para acessar áreas administrativas, use as credenciais:
   - Usuário: `admin`
   - Senha: `admin`

### Erros ao Iniciar o Servidor

Se o servidor não iniciar corretamente:

1. Verifique os logs de erro no console
2. Confirme que todas as dependências foram instaladas
3. Verifique se as variáveis de ambiente estão configuradas corretamente
4. Se aparecer o erro `DATABASE_URL must be set`, adicione essa variável ao seu `.env` ou verifique se as variáveis PG* estão configuradas corretamente

## Desenvolvimento

Para contribuir com o desenvolvimento:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request
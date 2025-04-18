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

### 3. Configurar o Banco de Dados

#### Criar banco de dados PostgreSQL

```bash
createdb acrdsc_reservas
```

#### Importar o esquema inicial

O arquivo `schema.sql` contém todas as tabelas e dados iniciais necessários:

```bash
# Método 1: Conectar e executar o script
psql -h localhost -U seu_usuario -d acrdsc_reservas
\i schema.sql

# Método 2 (alternativo): Importar diretamente
psql -h localhost -U seu_usuario -d acrdsc_reservas -f schema.sql
```

### 4. Configurar Variáveis de Ambiente

Para facilitar a configuração inicial, execute o script auxiliar:

```bash
node setup.js
```

Este script:
- Verifica se o Node.js está na versão correta
- Cria um arquivo `.env` de exemplo se não existir
- Verifica a instalação do PostgreSQL
- Fornece instruções detalhadas para configuração e solução de problemas

Em seguida, edite o arquivo `.env` criado com suas informações:

```env
# Configuração do Banco de Dados
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/acrdsc_reservas
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

### Script Especial para Ambiente Local

Se você estiver tendo problemas para executar o projeto localmente, especialmente com a conexão ao banco de dados, utilize o script especial criado para ambiente local:

```bash
node local-server.js
```

Este script:
- Substitui temporariamente o arquivo db.ts com uma versão otimizada para ambiente local
- Carrega as variáveis de ambiente do arquivo .env de forma mais robusta
- Fornece mensagens de erro mais claras sobre problemas de configuração
- Restaura automaticamente os arquivos originais ao encerrar

### Problemas de Conexão com o Banco de Dados

Se você encontrar erros de conexão com o banco de dados:

1. Verifique se o PostgreSQL está em execução
2. Confirme se as credenciais no arquivo `.env` estão corretas
3. Verifique se o banco de dados foi criado corretamente

### Erros ao Iniciar o Servidor

Se o servidor não iniciar corretamente:

1. Verifique os logs de erro no console
2. Confirme que todas as dependências foram instaladas
3. Verifique se as variáveis de ambiente estão configuradas corretamente

#### Erro no vite.config.ts

Se você encontrar erros como `The "paths[0]" argument must be of type string` relacionados ao vite.config.ts:

1. Certifique-se de estar usando Node.js v18+ que suporta `import.meta.url` e ESM
2. Execute o script de configuração primeiro: `node setup.js`
3. As variáveis de ambiente devem estar adequadamente configuradas no arquivo .env

#### Problemas com import.meta.dirname

Este projeto foi desenvolvido com Node.js v20.6+ que suporta `import.meta.dirname`. Se você estiver usando uma versão anterior (mas pelo menos v18), execute o script de configuração que criará um ambiente compatível:

```bash
chmod +x setup.js
node setup.js
```

## Desenvolvimento

Para contribuir com o desenvolvimento:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request
# ACRDSC Reservas - Guia de Instalação Local

Este guia fornece instruções detalhadas para configurar e executar o sistema ACRDSC Reservas em um ambiente local sem acesso à Internet.

## Requisitos

- Node.js v18+ instalado (recomendado v23+ para melhor compatibilidade)
- PostgreSQL v13+ instalado e em execução
- npm (gerenciador de pacotes do Node.js)

## Configuração do Banco de Dados

1. Crie um banco de dados no PostgreSQL:

```sql
CREATE DATABASE acrdsc_reservas;
```

2. Importe o esquema SQL para o banco de dados:

```bash
psql -U seu_usuario -d acrdsc_reservas -f schema.sql
```

## Instalação de Dependências

Execute os comandos a seguir para instalar as dependências necessárias:

```bash
# Tornar o script de instalação executável
chmod +x install-deps.sh

# Executar script de instalação
./install-deps.sh
```

Alternativamente, você pode instalar manualmente:

```bash
npm install pg @types/pg
```

## Configuração do Ambiente

1. Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
# Configurações do banco de dados
PGHOST=localhost
PGPORT=5432
PGUSER=seu_usuario_do_postgres
PGPASSWORD=sua_senha_do_postgres
PGDATABASE=acrdsc_reservas

# Outras configurações
NODE_ENV=development
SESSION_SECRET=chave_secreta_para_sessoes

# Configurações do Mailjet (opcional, apenas se for usar email)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
```

## Executando a Aplicação

Use o script `local-server.js` para iniciar a aplicação em modo local:

```bash
node local-server.js
```

Este script fará o seguinte:
1. Substituir os arquivos de configuração com versões compatíveis para execução local
2. Carregar as variáveis de ambiente do arquivo `.env`
3. Iniciar o servidor na porta 5000

A aplicação estará acessível em: http://localhost:5000

## Recursos Disponíveis

- Dashboard com métricas e análises
- Gerenciamento de locais e salas
- Sistema de reservas
- Relatórios financeiros
- Controle de acesso baseado em funções

## Solução de Problemas

### Erro de conexão com banco de dados

Se você encontrar erros de conexão com o banco de dados:

1. Verifique se o PostgreSQL está em execução
2. Confirme que as credenciais no arquivo `.env` estão corretas
3. Verifique se o banco de dados existe e foi criado corretamente
4. Certifique-se de que o arquivo schema.sql foi importado corretamente

### Erro de módulo 'pg'

Se encontrar erros relacionados ao módulo 'pg':

```
# Instale manualmente o pacote pg
npm install pg @types/pg

# Ou execute o script de instalação completo
./install-deps.sh
```

### Compatibilidade com Node.js

- **Node.js v23+**: Suporte completo, sem problemas de importação ES Module
- **Node.js v18-v22**: Pode precisar de ajustes para compatibilidade ES Module
- **Node.js v16 ou anterior**: Não suportado

Se você estiver usando Node.js v23+, como é o seu caso, o sistema deve funcionar sem necessidade de ajustes especiais relacionados ao ES Module.

### Outros erros

Para outros erros, verifique os logs do servidor para obter mais informações sobre o problema.

## Backups

Recomendamos fazer backups regulares do banco de dados PostgreSQL:

```bash
pg_dump -U seu_usuario -d acrdsc_reservas > backup_acrdsc_$(date +%Y%m%d).sql
```

---

Para mais informações ou suporte, entre em contato com a equipe de desenvolvimento.
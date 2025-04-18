#!/bin/bash

# Cores para feedback visual
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${YELLOW}=== ACRDSC Reservas - Configuração do Ambiente de Produção ===${RESET}\n"

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}Erro: Node.js não está instalado!${RESET}"
    echo -e "${BLUE}Por favor, instale o Node.js v18+ ou v23+ antes de continuar:${RESET}"
    echo -e "  - Ubuntu/Debian: sudo apt install nodejs npm"
    echo -e "  - CentOS/RHEL: sudo yum install nodejs npm"
    echo -e "  - Ou baixe do site oficial: https://nodejs.org/"
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js está instalado:${RESET} $NODE_VERSION"

# Extrair a versão principal
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f1 | tr -d 'v')

# Verificar compatibilidade da versão
if [ "$MAJOR_VERSION" -lt 18 ]; then
    echo -e "${RED}⚠ Atenção: O Node.js v$MAJOR_VERSION não é compatível.${RESET}"
    echo -e "${BLUE}É necessário usar o Node.js v18+ ou v23+.${RESET}"
    echo -e "${YELLOW}Deseja continuar mesmo assim? (s/n)${RESET}"
    read -r resposta
    if [[ "$resposta" != "s" && "$resposta" != "S" ]]; then
        echo -e "${RED}Instalação cancelada.${RESET}"
        exit 1
    fi
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Erro: npm não está instalado!${RESET}"
    echo -e "${BLUE}Por favor, instale o npm:${RESET}"
    echo -e "  - Ubuntu/Debian: sudo apt install npm"
    exit 1
fi

# Verificar se PostgreSQL está instalado 
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}Aviso: PostgreSQL não parece estar instalado ou não está no PATH.${RESET}"
    echo -e "${BLUE}Um banco de dados PostgreSQL é necessário para o funcionamento da aplicação.${RESET}"
    echo -e "Instruções de instalação:"
    echo -e "  - Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo -e "  - CentOS/RHEL: sudo yum install postgresql-server postgresql-contrib"
    echo -e "${YELLOW}Você gostaria de continuar mesmo assim? (s/n)${RESET}"
    read -r resposta
    if [[ "$resposta" != "s" && "$resposta" != "S" ]]; then
        echo -e "${RED}Instalação cancelada.${RESET}"
        exit 1
    fi
fi

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 não está instalado. Instalando...${RESET}"
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo -e "${RED}Erro ao instalar PM2. Tente manualmente:${RESET}"
        echo -e "  sudo npm install -g pm2"
        exit 1
    fi
    echo -e "${GREEN}✓ PM2 instalado com sucesso.${RESET}"
else
    echo -e "${GREEN}✓ PM2 já está instalado.${RESET}"
fi

# Verificar dependências do projeto
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Instalando dependências do projeto...${RESET}"
    npm ci || npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Erro ao instalar dependências. Verifique o erro acima.${RESET}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependências instaladas com sucesso.${RESET}"
else
    echo -e "${GREEN}✓ Dependências já instaladas.${RESET}"
fi

# Verificar módulos específicos
echo -e "${YELLOW}Verificando módulos específicos...${RESET}"
npm list pg > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Instalando módulo pg...${RESET}"
    npm install pg @types/pg
fi

# Criar arquivo ecosystem.config.js para PM2 se não existir
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${YELLOW}Criando configuração do PM2...${RESET}"
    cat > ecosystem.config.js << EOF
module.exports = {
  apps : [{
    name: "acrdsc-reservas",
    script: "./production-server.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
    }
  }]
};
EOF
    echo -e "${GREEN}✓ Arquivo ecosystem.config.js criado.${RESET}"
else
    echo -e "${GREEN}✓ Arquivo ecosystem.config.js já existe.${RESET}"
fi

# Verificar arquivo .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Criando arquivo .env de exemplo...${RESET}"
    cat > .env << EOF
# Configurações do banco de dados
# Você pode usar uma URL completa de conexão:
DATABASE_URL=postgres://postgres:postgres@localhost:5432/acrdsc_reservas

# Ou especificar os parâmetros individualmente:
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=acrdsc_reservas

# Outras configurações
NODE_ENV=production
SESSION_SECRET=production_secret_key_change_this

# Configurações do Mailjet para envio de emails (opcional)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
EOF
    echo -e "${GREEN}✓ Arquivo .env criado. EDITE ESTE ARQUIVO com suas credenciais de banco de dados!${RESET}"
else
    echo -e "${GREEN}✓ Arquivo .env já existe.${RESET}"
fi

echo -e "\n${GREEN}=== Configuração concluída com sucesso! ===${RESET}"
echo -e "${BLUE}Para iniciar o servidor em produção:${RESET}"
echo -e "  pm2 start ecosystem.config.js"
echo -e "\n${BLUE}Para visualizar os logs:${RESET}"
echo -e "  pm2 logs"
echo -e "\n${BLUE}Para reiniciar o servidor:${RESET}"
echo -e "  pm2 restart acrdsc-reservas"
echo -e "\n${BLUE}Para configurar o início automático após reboot:${RESET}"
echo -e "  pm2 startup"
echo -e "  pm2 save"
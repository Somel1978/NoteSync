#!/bin/bash

# Cores para feedback visual
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${YELLOW}=== ACRDSC Reservas - Instalação de Dependências Locais ===${RESET}\n"

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}Erro: Node.js não está instalado!${RESET}"
    echo -e "${BLUE}Por favor, instale o Node.js v18+ antes de continuar:${RESET}"
    echo -e "  - Ubuntu/Debian: sudo apt install nodejs npm"
    echo -e "  - CentOS/RHEL: sudo yum install nodejs npm"
    echo -e "  - Ou baixe do site oficial: https://nodejs.org/"
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js está instalado:${RESET} $NODE_VERSION"

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Erro: npm não está instalado!${RESET}"
    echo -e "${BLUE}Por favor, instale o npm:${RESET}"
    echo -e "  - Ubuntu/Debian: sudo apt install npm"
    exit 1
fi

# Verificar se temos permissões de admin (necessárias para instalar globalmente)
echo -e "${YELLOW}Verificando permissões...${RESET}"

# Verificar se PostgreSQL está instalado 
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}Aviso: PostgreSQL não parece estar instalado ou não está no PATH.${RESET}"
    echo -e "${BLUE}Um banco de dados PostgreSQL é necessário para o funcionamento da aplicação.${RESET}"
    echo -e "Instruções de instalação:"
    echo -e "  - Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo -e "  - CentOS/RHEL: sudo yum install postgresql-server postgresql-contrib"
    echo -e "  - Windows: https://www.postgresql.org/download/windows/"
    echo -e "${YELLOW}Você gostaria de continuar mesmo assim? (s/n)${RESET}"
    read -r resposta
    if [[ "$resposta" != "s" && "$resposta" != "S" ]]; then
        echo -e "${RED}Instalação cancelada.${RESET}"
        exit 1
    fi
fi

# Verificar se o diretório node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Diretório node_modules não encontrado. Executando npm install...${RESET}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Erro ao executar npm install. Verifique os logs acima.${RESET}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependências principais instaladas.${RESET}"
fi

# Instalar dependências específicas para PostgreSQL local
echo -e "${YELLOW}Instalando módulos para PostgreSQL local...${RESET}"

# Tenta instalar pg normalmente
npm install pg @types/pg

# Verificar se a instalação foi bem-sucedida
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Módulos instalados com sucesso!${RESET}"
    
    # Verificar se pg está acessível
    if node -e "try { require('pg'); console.log('✓ pg está acessível'); } catch(e) { console.error('❌ pg não está acessível'); process.exit(1); }"; then
        echo -e "${GREEN}✓ Módulo pg está corretamente instalado e acessível${RESET}"
    else
        echo -e "${RED}❌ O módulo pg foi instalado mas não está acessível.${RESET}"
        echo -e "${YELLOW}Tentando instalação alternativa...${RESET}"
        
        # Tentativa alternativa: instalar globalmente
        echo -e "${YELLOW}Tentando instalar pg globalmente com sudo:${RESET}"
        sudo npm install -g pg @types/pg
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Instalação global bem-sucedida.${RESET}"
        else
            echo -e "${RED}❌ Não foi possível instalar pg globalmente.${RESET}"
            echo -e "${BLUE}Por favor, contate o administrador do sistema ou tente:${RESET}"
            echo -e "  1. sudo npm install -g pg @types/pg"
            echo -e "  2. Alterar server/db.local.ts para uma abordagem diferente"
        fi
    fi
else
    echo -e "\n${RED}Houve um erro na instalação das dependências.${RESET}"
    echo -e "${BLUE}Tente os seguintes passos:${RESET}"
    echo -e "  1. Instalar manualmente: sudo npm install -g pg @types/pg"
    echo -e "  2. Verificar permissões da pasta node_modules"
    echo -e "  3. Verificar configurações de rede caso o NPM precise de proxy"
fi

echo -e "\n${GREEN}Instalação concluída.${RESET}"
echo -e "${BLUE}Agora você pode executar:${RESET} node local-server.js"
echo ""
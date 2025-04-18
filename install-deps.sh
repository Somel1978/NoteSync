#!/bin/bash

# Cores para feedback visual
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "${YELLOW}=== ACRDSC Reservas - Instalação de Dependências Locais ===${RESET}\n"

# Verificar npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Erro: npm não está instalado! Por favor, instale o Node.js e npm.${RESET}"
    exit 1
fi

# Instalar dependências para conexão PostgreSQL local
echo -e "${YELLOW}Instalando módulos para PostgreSQL local...${RESET}"
npm install pg @types/pg drizzle-orm

# Verificar se a instalação foi bem-sucedida
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Módulos instalados com sucesso!${RESET}"
    echo -e "${GREEN}Agora você pode executar: node local-server.js${RESET}"
else
    echo -e "\n${RED}Houve um erro na instalação das dependências.${RESET}"
    echo -e "${YELLOW}Tente executar manualmente: npm install pg @types/pg drizzle-orm${RESET}"
fi

echo ""
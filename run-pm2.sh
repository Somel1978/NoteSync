#!/bin/bash

# Cores para feedback visual
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${YELLOW}=== ACRDSC Reservas - Inicialização com PM2 ===${RESET}\n"

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 não está instalado.${RESET}"
    echo -e "${YELLOW}Instalando PM2 globalmente...${RESET}"
    npm install -g pm2
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Falha ao instalar PM2.${RESET}"
        echo -e "${YELLOW}Tente instalar manualmente:${RESET}"
        echo -e "npm install -g pm2"
        exit 1
    fi
    echo -e "${GREEN}PM2 instalado com sucesso.${RESET}"
else
    echo -e "${GREEN}✓ PM2 já está instalado.${RESET}"
fi

# Iniciar o servidor com PM2
echo -e "${YELLOW}Iniciando aplicação com PM2...${RESET}"
pm2 start ecosystem.config.js

# Verificar se a inicialização foi bem-sucedida
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Aplicação iniciada com sucesso!${RESET}"
    echo -e "${BLUE}Para visualizar os logs:${RESET} pm2 logs acrdsc-reservas"
    echo -e "${BLUE}Para parar a aplicação:${RESET} pm2 stop acrdsc-reservas"
    echo -e "${BLUE}Para configurar inicialização automática:${RESET}"
    echo -e "  pm2 startup"
    echo -e "  pm2 save"
else
    echo -e "${RED}Falha ao iniciar a aplicação com PM2.${RESET}"
    echo -e "${YELLOW}Tente iniciar manualmente:${RESET}"
    echo -e "node server.js"
    exit 1
fi
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Esta migração adiciona o status "finished" e o campo "final_revenue" 
 * para rastrear agendamentos concluídos e confirmar a receita real.
 */
export async function addFinishedStatus() {
  console.log("Iniciando migração para adicionar status 'finished' e campo de receita final");
  
  try {
    // Adicionar diretamente o valor 'finished' ao enum appointment_status
    // A sintaxe IF NOT EXISTS garante que não haverá erro se o valor já existir
    console.log("Adicionando 'finished' ao tipo enum appointment_status");
    
    try {
      await db.execute(sql.raw(`
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'finished';
      `));
      console.log("Status 'finished' adicionado ou já existente");
    } catch (error) {
      console.log("Nota: Se o erro for sobre o valor já existir, a migração continuará normalmente");
      console.error("Erro específico do ALTER TYPE:", error);
    }
    
    // Verifica se o campo final_revenue já existe
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' 
      AND column_name = 'final_revenue';
    `;
    
    const columnResult = await db.execute(sql.raw(checkColumnsQuery));
    // Usar o operador casting correto para evitar o erro TypeScript
    const hasColumn = (columnResult as any).rowCount > 0;
    
    if (!hasColumn) {
      // Adicionar coluna final_revenue à tabela appointments
      console.log("Adicionando coluna final_revenue à tabela appointments");
      
      await db.execute(sql.raw(`
        ALTER TABLE appointments ADD COLUMN IF NOT EXISTS final_revenue INTEGER;
      `));
    } else {
      console.log("Coluna final_revenue já existe na tabela appointments");
    }
    
    console.log("Migração concluída com sucesso!");
    return { success: true };
  } catch (error) {
    console.error("Erro durante a migração:", error);
    return { success: false, error };
  }
}
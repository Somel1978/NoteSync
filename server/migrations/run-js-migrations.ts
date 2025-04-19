import { addFinishedStatus } from './finished-status';

/**
 * Execute todas as migrações JavaScript
 */
async function runJsMigrations() {
  try {
    console.log('Iniciando migrações JavaScript...');
    
    // Adiciona o status 'finished' e o campo final_revenue
    const finishedStatusResult = await addFinishedStatus();
    
    if (finishedStatusResult.success) {
      console.log('Migração de status finalizado concluída com sucesso!');
    } else {
      console.error('Erro na migração de status finalizado:', finishedStatusResult.error);
      process.exit(1);
    }
    
    console.log('Todas as migrações JavaScript foram concluídas com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao executar migrações JavaScript:', error);
    process.exit(1);
  }
}

runJsMigrations();
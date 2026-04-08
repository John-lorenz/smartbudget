/** Mensagem segura para o cliente quando o problema é infraestrutura (DB). */
function clientMessageForDbError(err) {
  if (!err || !err.code) return null;

  const dbAuthCodes = ['28P01', '28000'];
  const dbConnCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];

  if (dbAuthCodes.includes(err.code)) {
    return 'Falha ao conectar ao banco: usuário ou senha incorretos na configuração do servidor.';
  }
  if (dbConnCodes.includes(err.code) || err.code === '57P01') {
    return 'Banco de dados indisponível. Verifique se o PostgreSQL está em execução e se host e porta estão corretos no ambiente.';
  }
  return null;
}

module.exports = { clientMessageForDbError };

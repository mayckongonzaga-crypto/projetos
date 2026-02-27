/**
 * Sanitiza mensagens de erro para exibição ao usuário.
 * Remove detalhes técnicos de SQL, queries, parâmetros, etc.
 * Mantém apenas uma mensagem amigável e útil.
 */

export function sanitizeErrorMessage(rawMessage: string | null | undefined): string {
  if (!rawMessage) return "Erro desconhecido";

  const msg = rawMessage.trim();

  // Erro de SQL: Failed query / insert into / select / update / delete
  if (/^Failed query:/i.test(msg) || /^(insert|select|update|delete)\s+/i.test(msg)) {
    // Tentar extrair o nome da tabela para dar contexto
    const tableMatch = msg.match(/(?:into|from|update)\s+[`']?(\w+)[`']?/i);
    const table = tableMatch ? tableMatch[1] : "banco de dados";

    if (/duplicate/i.test(msg)) {
      return `Registro duplicado na tabela ${table}. O CT-e já pode existir no sistema.`;
    }
    if (/column.*not found|unknown column/i.test(msg)) {
      return `Erro de estrutura no banco (tabela ${table}). Execute "pnpm db:push" para atualizar.`;
    }
    if (/data too long/i.test(msg)) {
      return `Dados muito longos para salvar na tabela ${table}. Verifique os campos do CT-e.`;
    }
    return `Erro ao salvar dados na tabela ${table}. Verifique a estrutura do banco de dados.`;
  }

  // Erro de conexão com banco
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection refused/i.test(msg)) {
    return "Erro de conexão com o banco de dados. Verifique se o MySQL está rodando.";
  }

  // Erro de certificado digital
  if (/certificate|certificado|pfx|pkcs/i.test(msg)) {
    return "Erro no certificado digital. Verifique se o certificado é válido e não está vencido.";
  }

  // Erro de rede / SEFAZ
  if (/ECONNRESET|EPROTO|socket hang up|network/i.test(msg)) {
    return "Erro de comunicação com a SEFAZ. Tente novamente em alguns minutos.";
  }

  // Erro de timeout
  if (/timeout|timed out/i.test(msg)) {
    return "Tempo limite excedido na comunicação com a SEFAZ. Tente novamente.";
  }

  // Erro de SSL
  if (/SSL|TLS|handshake/i.test(msg)) {
    return "Erro de segurança (SSL/TLS) na comunicação. Verifique o certificado digital.";
  }

  // Se a mensagem é muito longa (provavelmente técnica), truncar
  if (msg.length > 200) {
    // Pegar a primeira frase significativa
    const firstSentence = msg.split(/[.\n]/)[0];
    if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
      return firstSentence.trim();
    }
    return msg.substring(0, 150) + "...";
  }

  return msg;
}

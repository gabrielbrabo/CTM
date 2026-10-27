// Erro com status HTTP: lance em qualquer lugar e o errorHandler responde
export class HttpError extends Error {
  status: number;
  dados?: Record<string, unknown>; // informacoes extras para o front (ex.: id da publicacao repetida)

  constructor(status: number, mensagem: string, dados?: Record<string, unknown>) {
    super(mensagem);
    this.status = status;
    this.dados = dados;
    this.name = "HttpError";
  }
}

export const naoAutenticado = (msg = "Nao autenticado") => new HttpError(401, msg);
export const proibido = (msg = "Sem permissao para esta acao") => new HttpError(403, msg);
export const naoEncontrado = (msg = "Nao encontrado") => new HttpError(404, msg);

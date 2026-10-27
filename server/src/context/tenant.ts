import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto do municipio (tenant) da requisicao atual.
 *
 * O AsyncLocalStorage funciona como uma "variavel global por requisicao":
 * o middleware define o municipio uma vez e qualquer codigo chamado depois
 * (controllers, models, plugin do Mongoose) consegue ler esse valor sem
 * precisar passar parametro por parametro.
 */
export interface TenantStore {
  municipioId?: string;
  usuarioId?: string;
  // true = ignora o isolamento (somente rotas da plataforma/superadmin e scripts)
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

export function getTenant(): TenantStore | undefined {
  return storage.getStore();
}

export function getMunicipioId(): string | undefined {
  return storage.getStore()?.municipioId;
}

/**
 * Roda fn dentro do contexto. IMPORTANTE: consultas do Mongoose sao "preguicosas"
 * (so executam no await). Se fn devolver uma Query/Aggregate, ela e disparada
 * aqui dentro, senao executaria fora do contexto e o municipio se perderia.
 */
function rodar<T>(store: TenantStore, fn: () => T): T {
  return storage.run(store, () => {
    const resultado = fn();
    if (resultado && typeof (resultado as { then?: unknown }).then === "function") {
      return Promise.resolve(resultado) as T;
    }
    return resultado;
  });
}

// Executa fn dentro do contexto de um municipio
export function runWithTenant<T>(store: TenantStore, fn: () => T): T {
  return rodar({ ...store }, fn);
}

// Executa fn sem isolamento (use com cuidado: so plataforma e scripts)
export function semTenant<T>(fn: () => T): T {
  return rodar({ ...(storage.getStore() || {}), bypass: true }, fn);
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Presenca, PresencaVereador, Vereador, Voto, VotoVereador, orgaoApi } from "../../../api/orgao";
import { FotoVereador } from "../../../components/FotoVereador";
import { Secao } from "../../../components/ui";
import { TipoPublicacaoDef } from "../../../lib/tiposPublicacao";
import { COR_PRESENCA, COR_VOTO, NOME_PRESENCA, NOME_VOTO, nomeVereador } from "../../../lib/vereadores";

export interface ValorVereadores {
  autoresIds: string[];
  relatorId: string | null;
  votos: VotoVereador[];
  presencas: PresencaVereador[];
}

// Botoes lado a lado para escolher uma opcao (voto ou presenca)
function Opcoes<T extends string>({
  valor,
  opcoes,
  nomes,
  cores,
  rotulo,
  desabilitado,
  onEscolher,
}: {
  valor: T | null;
  opcoes: T[];
  nomes: Record<string, string>;
  cores: Record<string, string>;
  rotulo: string;
  desabilitado?: boolean;
  onEscolher: (v: T | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-1">
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          disabled={desabilitado}
          onClick={() => onEscolher(valor === o ? null : o)}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
            valor === o ? `${cores[o]} border-transparent ring-1 ring-current` : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {nomes[o]}
        </button>
      ))}
    </div>
  );
}

function NomeComFoto({ v }: { v: Vereador }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FotoVereador url={v.fotoUrl} nome={nomeVereador(v)} tamanho="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{nomeVereador(v)}</span>
        <span className="block text-xs text-slate-500">{v.partido ?? "Sem partido"}</span>
      </span>
    </span>
  );
}

/**
 * Parte do formulario da publicacao ligada aos vereadores (so Camara):
 * autores, relator, voto nominal e presenca — conforme o tipo.
 */
export default function CamposVereadores({
  orgaoId,
  def,
  valor,
  onChange,
  desabilitado,
}: {
  orgaoId: string;
  def: TipoPublicacaoDef;
  valor: ValorVereadores;
  onChange: (v: ValorVereadores) => void;
  desabilitado?: boolean;
}) {
  const painel = useQuery({ queryKey: ["orgao", orgaoId, "painel"], queryFn: () => orgaoApi(orgaoId).painel() });
  const ehCamara = painel.data?.orgao.tipo === "camara";
  // Prefeitura: so a votacao (ex.: lei votada pelos vereadores da Camara)
  const vinc = ehCamara ? (def.vinculos ?? {}) : { votacao: def.vinculos?.votacao };
  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["orgao", orgaoId, "vereadores"],
    queryFn: () => orgaoApi(orgaoId).vereadores(),
  });
  if (!vinc.autores && !vinc.relator && !vinc.votacao && !vinc.presenca) return null;

  // Mostra quem esta no mandato + quem ja foi escolhido nesta publicacao
  const escolhidos = new Set([
    ...valor.autoresIds,
    ...(valor.relatorId ? [valor.relatorId] : []),
    ...valor.votos.map((x) => x.vereadorId),
    ...valor.presencas.map((x) => x.vereadorId),
  ]);
  const lista = todos.filter((v) => v.situacao === "exercicio" || escolhidos.has(v.id));
  const votoDe = (id: string) => valor.votos.find((x) => x.vereadorId === id)?.voto ?? null;
  const presencaDe = (id: string) => valor.presencas.find((x) => x.vereadorId === id)?.situacao ?? null;

  function trocarAutor(id: string) {
    const ja = valor.autoresIds.includes(id);
    onChange({ ...valor, autoresIds: ja ? valor.autoresIds.filter((x) => x !== id) : [...valor.autoresIds, id] });
  }
  function votar(id: string, voto: Voto | null) {
    const resto = valor.votos.filter((x) => x.vereadorId !== id);
    onChange({ ...valor, votos: voto ? [...resto, { vereadorId: id, voto }] : resto });
  }
  function marcarPresenca(id: string, situacao: Presenca | null) {
    const resto = valor.presencas.filter((x) => x.vereadorId !== id);
    onChange({ ...valor, presencas: situacao ? [...resto, { vereadorId: id, situacao }] : resto });
  }

  const contaVoto = (v: Voto) => valor.votos.filter((x) => x.voto === v).length;
  const contaPresenca = (p: Presenca) => valor.presencas.filter((x) => x.situacao === p).length;

  return (
    <Secao titulo="Vereadores">
      {isLoading && <p className="text-sm text-slate-500">Carregando vereadores...</p>}
      {!isLoading && todos.length === 0 && (
        <p className="text-sm text-slate-600">
          {ehCamara ? (
            <>
              Nenhum vereador cadastrado.{" "}
              <Link to={`/admin/o/${orgaoId}/vereadores`} className="font-medium text-blue-700 hover:underline">
                Cadastre os vereadores
              </Link>{" "}
              para escolher autores, votos e presença.
            </>
          ) : (
            "A Câmara deste município ainda não cadastrou os vereadores no sistema; por isso a votação não pode ser lançada aqui."
          )}
        </p>
      )}

      {lista.length > 0 && (
        <div className="space-y-6">
          {vinc.autores && (
            <fieldset disabled={desabilitado}>
              <legend className="text-sm font-medium text-slate-700">
                Autor(es) <span className="font-normal text-slate-500">— marque o(s) vereador(es). Se for outro autor, use “Outros autores” nos dados específicos.</span>
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((v) => {
                  const marcado = valor.autoresIds.includes(v.id);
                  return (
                    <label
                      key={v.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${
                        marcado ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <input type="checkbox" checked={marcado} onChange={() => trocarAutor(v.id)} aria-label={`Autor: ${nomeVereador(v)}`} />
                      <NomeComFoto v={v} />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {vinc.relator && (
            <label className="block max-w-md text-sm font-medium text-slate-700">
              Relator(a)
              <select
                disabled={desabilitado}
                value={valor.relatorId ?? ""}
                onChange={(e) => onChange({ ...valor, relatorId: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
              >
                <option value="">— Nenhum / não é vereador da lista —</option>
                {lista.map((v) => (
                  <option key={v.id} value={v.id}>
                    {nomeVereador(v)}
                    {v.partido ? ` (${v.partido})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {vinc.votacao && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Votação dos vereadores{" "}
                  <span className="font-normal text-slate-500">— preencha quando a matéria for votada (aparece para a população com foto e voto).</span>
                </p>
                {!desabilitado && (
                  <div className="flex gap-3 text-sm">
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => onChange({ ...valor, votos: lista.map((v) => ({ vereadorId: v.id, voto: "sim" })) })}>
                      Todos favoráveis
                    </button>
                    <button type="button" className="text-slate-600 hover:underline" onClick={() => onChange({ ...valor, votos: [] })}>
                      Limpar votos
                    </button>
                  </div>
                )}
              </div>
              {valor.votos.length > 0 && (
                <p className="mt-1 text-sm text-slate-600">
                  Favoráveis: <strong>{contaVoto("sim")}</strong> · Contrários: <strong>{contaVoto("nao")}</strong> · Abstenção:{" "}
                  <strong>{contaVoto("abstencao")}</strong> · Ausente: <strong>{contaVoto("ausente")}</strong>
                </p>
              )}
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {lista.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <NomeComFoto v={v} />
                    <Opcoes<Voto>
                      rotulo={`Voto de ${nomeVereador(v)}`}
                      valor={votoDe(v.id)}
                      opcoes={["sim", "nao", "abstencao", "ausente"]}
                      nomes={NOME_VOTO}
                      cores={COR_VOTO}
                      desabilitado={desabilitado}
                      onEscolher={(x) => votar(v.id, x)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vinc.presenca && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Presença na sessão <span className="font-normal text-slate-500">— opcional.</span>
                </p>
                {!desabilitado && (
                  <div className="flex gap-3 text-sm">
                    <button
                      type="button"
                      className="text-blue-700 hover:underline"
                      onClick={() => onChange({ ...valor, presencas: lista.map((v) => ({ vereadorId: v.id, situacao: "presente" })) })}
                    >
                      Todos presentes
                    </button>
                    <button type="button" className="text-slate-600 hover:underline" onClick={() => onChange({ ...valor, presencas: [] })}>
                      Limpar
                    </button>
                  </div>
                )}
              </div>
              {valor.presencas.length > 0 && (
                <p className="mt-1 text-sm text-slate-600">
                  Presentes: <strong>{contaPresenca("presente")}</strong> · Ausentes: <strong>{contaPresenca("ausente")}</strong> ·
                  Justificadas: <strong>{contaPresenca("justificada")}</strong>
                </p>
              )}
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {lista.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <NomeComFoto v={v} />
                    <Opcoes<Presenca>
                      rotulo={`Presença de ${nomeVereador(v)}`}
                      valor={presencaDe(v.id)}
                      opcoes={["presente", "ausente", "justificada"]}
                      nomes={{ ...NOME_PRESENCA, justificada: "Justificada" }}
                      cores={COR_PRESENCA}
                      desabilitado={desabilitado}
                      onEscolher={(x) => marcarPresenca(v.id, x)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Secao>
  );
}

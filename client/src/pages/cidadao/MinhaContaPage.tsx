import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { cidadaoApi } from "../../api/cidadao";
import { Carregando, Vazio } from "../../components/Estado";
import { Logo } from "../../components/Logo";
import { Botao } from "../../components/ui";
import { useCidadao } from "../../context/CidadaoContext";
import { useAvisos } from "../../lib/avisos";
import { formatarDataHora } from "../../lib/formato";

export const NOME_SITUACAO_MSG: Record<string, string> = { aberta: "Aguardando resposta", respondida: "Respondida", encerrada: "Encerrada" };
export const COR_SITUACAO_MSG: Record<string, string> = {
  aberta: "bg-amber-100 text-amber-900",
  respondida: "bg-green-100 text-green-900",
  encerrada: "bg-slate-200 text-slate-700",
};

// Minha conta: notificacoes, mensagens e municipios seguidos
export default function MinhaContaPage() {
  const { conta, carregando, atualizar, sair } = useCidadao();
  const { avisar } = useAvisos();
  const navigate = useNavigate();
  const location = useLocation();
  const [pagina, setPagina] = useState(1);
  const notifs = useQuery({ queryKey: ["cidadao", "notificacoes", pagina], queryFn: () => cidadaoApi.notificacoes(pagina), enabled: Boolean(conta) });
  const mensagens = useQuery({ queryKey: ["cidadao", "mensagens"], queryFn: cidadaoApi.mensagens, enabled: Boolean(conta) });

  // Link "#mensagens" do menu: rola ate a secao
  useEffect(() => {
    if (location.hash === "#mensagens" && mensagens.data) document.getElementById("mensagens")?.scrollIntoView();
  }, [location.hash, mensagens.data]);

  if (carregando) return <Carregando />;
  if (!conta) return <Navigate to="/entrar?voltar=/minha-conta" replace />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Olá, {conta.cidadao.nome.split(" ")[0]}</h1>
          <p className="text-sm text-slate-600">{conta.cidadao.email}</p>
        </div>
        <Botao variante="secundario" onClick={() => sair().then(() => navigate("/"))}>
          Sair da conta
        </Botao>
      </div>

      <section id="mensagens">
        <h2 className="text-lg font-semibold">Minhas mensagens</h2>
        <p className="text-sm text-slate-600">Para mandar uma mensagem, abra a página da Prefeitura ou da Câmara e use “Fale com...”.</p>
        <div className="mt-3">
          {mensagens.isLoading && <Carregando />}
          {mensagens.data && mensagens.data.length === 0 && <Vazio texto="Você ainda não enviou mensagens." />}
          {mensagens.data && mensagens.data.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {mensagens.data.map((m) => (
                <li key={m.id}>
                  <Link to={`/minha-conta/mensagens/${m.id}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 ${m.lida ? "" : "bg-blue-50"}`}>
                    <Logo url={m.orgao?.logoUrl} nome={m.orgao?.nome ?? "Órgão"} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800">{m.assunto}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO_MSG[m.situacao]}`}>{NOME_SITUACAO_MSG[m.situacao]}</span>
                        {!m.lida && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">Nova resposta</span>}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {m.orgao?.nome} · protocolo {m.protocolo} · {formatarDataHora(m.ultimaAtividade)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Notificações ativas</h2>
        <p className="text-sm text-slate-600">Você recebe um aviso no sininho sempre que estes municípios publicarem algo.</p>
        {conta.seguindo.length === 0 ? (
          <div className="mt-3">
            <Vazio texto="Nenhum município. Abra a página de um município e clique em “Ativar notificações”." />
          </div>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {conta.seguindo.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2">
                <Logo url={m.brasaoUrl} nome={m.nome} tamanho="sm" />
                <Link to={`/${m.slug}`} className="text-sm font-medium text-blue-700 hover:underline">
                  {m.nome}/{m.uf}
                </Link>
                <button
                  type="button"
                  className="text-xs text-red-700 hover:underline"
                  onClick={async () => {
                    await cidadaoApi.deixarDeSeguir(m.slug);
                    atualizar();
                    avisar("sucesso", `Notificações de ${m.nome} desativadas.`);
                  }}
                >
                  Desativar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Notificações</h2>
          {Boolean(notifs.data?.naoLidas) && (
            <Botao
              variante="secundario"
              onClick={async () => {
                await cidadaoApi.marcarLidas();
                atualizar();
              }}
            >
              Marcar todas como lidas
            </Botao>
          )}
        </div>
        <div className="mt-3">
          {notifs.isLoading && <Carregando />}
          {notifs.data && notifs.data.itens.length === 0 && <Vazio texto="Nenhuma notificação ainda." />}
          {notifs.data && notifs.data.itens.length > 0 && (
            <>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {notifs.data.itens.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={n.link}
                      onClick={() => cidadaoApi.marcarLidas([n.id]).then(atualizar)}
                      className={`block px-4 py-3 hover:bg-slate-50 ${n.lida ? "" : "bg-blue-50"}`}
                    >
                      <span className="flex items-start gap-2">
                        {!n.lida && <span aria-label="não lida" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-800">{n.titulo}</span>
                          {n.texto && <span className="block truncate text-sm text-slate-600">{n.texto}</span>}
                          <span className="block text-xs text-slate-500">{formatarDataHora(n.criadaEm)}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {notifs.data.paginas > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <Botao variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
                    ← Mais recentes
                  </Botao>
                  <span>
                    Página {notifs.data.pagina} de {notifs.data.paginas}
                  </span>
                  <Botao variante="secundario" disabled={pagina >= notifs.data.paginas} onClick={() => setPagina(pagina + 1)}>
                    Mais antigas →
                  </Botao>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

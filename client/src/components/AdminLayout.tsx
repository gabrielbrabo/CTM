import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { orgaoApi } from "../api/orgao";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";
import { Sino } from "./Sino";
import { authApi } from "../api/auth";
import { SeletorTema } from "../lib/tema";
import { SeletorFonte } from "../lib/fonte";

type ItemMenu = { to: string; rotulo: string; fim?: boolean; contador?: number };

const MENU_PLATAFORMA: ItemMenu[] = [
  { to: "/admin", rotulo: "Painel", fim: true },
  { to: "/admin/orgaos", rotulo: "Órgãos" },
  { to: "/admin/municipios", rotulo: "Municípios" },
  { to: "/admin/usuarios", rotulo: "Usuários" },
  { to: "/admin/historico", rotulo: "Histórico" },
];

function Menu({ itens, titulo }: { itens: ItemMenu[]; titulo?: string }) {
  return (
    <nav aria-label="Menu do painel" className="md:w-52 md:shrink-0">
      {titulo && <p className="mb-2 hidden px-3 text-xs font-semibold uppercase text-slate-500 md:block">{titulo}</p>}
      <ul className="flex gap-2 overflow-x-auto md:flex-col">
        {itens.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.fim}
              className={({ isActive }) =>
                `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-white"
                }`
              }
            >
              <span className="flex items-center justify-between gap-2">
                {item.rotulo}
                {Boolean(item.contador) && (
                  <span className="rounded-full bg-red-600 px-1.5 text-xs font-bold text-white" aria-label={`${item.contador} não lida(s)`}>
                    {item.contador}
                  </span>
                )}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Troca rapida de orgao (para quem acessa mais de um)
function TrocarOrgao({ orgaoId }: { orgaoId: string }) {
  const { acessos } = useAuth();
  const navigate = useNavigate();
  if (acessos.length < 2) return null;
  return (
    <label className="mt-3 block px-3 text-xs font-medium text-slate-500">
      Trocar de órgão
      <select
        value={orgaoId}
        onChange={(e) => navigate(`/admin/o/${e.target.value}`)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
      >
        {acessos.map((a) => (
          <option key={a.orgaoId} value={a.orgaoId}>
            {a.orgaoNome}
          </option>
        ))}
      </select>
    </label>
  );
}

// Menu do painel de um orgao (Prefeitura/Camara)
function MenuOrgao({ orgaoId }: { orgaoId: string }) {
  const { usuario } = useAuth();
  const { data } = useQuery({ queryKey: ["orgao", orgaoId, "painel"], queryFn: () => orgaoApi(orgaoId).painel() });
  const base = `/admin/o/${orgaoId}`;
  const itens: ItemMenu[] = [
    { to: base, rotulo: "Início", fim: true },
    { to: `${base}/publicacoes`, rotulo: "Publicações" },
    { to: `${base}/mensagens`, rotulo: "Mensagens", contador: data?.mensagensNaoLidas },
  ];
  if (data?.orgao.tipo === "camara") itens.push({ to: `${base}/vereadores`, rotulo: "Vereadores" });
  if (data?.papel === "admin_orgao" || usuario?.plataformaAdmin) {
    itens.push({ to: `${base}/usuarios`, rotulo: "Usuários" });
    itens.push({ to: `${base}/historico`, rotulo: "Histórico" });
  }

  return (
    <div className="md:w-52 md:shrink-0">
      {/* Qual orgao esta aberto: logo + nome */}
      {data && (
        <Link to={base} className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-400">
          <Logo url={data.orgao.logoUrl} nome={data.orgao.nome} tamanho="sm" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-snug">{data.orgao.nome}</span>
            <span className="block text-xs text-slate-500">
              {data.municipio.nome}/{data.municipio.uf}
            </span>
          </span>
        </Link>
      )}
      <Menu itens={itens} />
      {!usuario?.plataformaAdmin && <TrocarOrgao orgaoId={orgaoId} />}
      <div className="mt-3 space-y-1 px-3 text-sm">
        {usuario?.plataformaAdmin && (
          <Link to="/admin/orgaos" className="block text-slate-600 hover:underline">
            ← Administração GADZ
          </Link>
        )}
      </div>
    </div>
  );
}

// Sininho do painel: mensagens da populacao ainda nao lidas (atualiza a cada minuto)
function SinoPainel() {
  const { data } = useQuery({ queryKey: ["avisos"], queryFn: authApi.avisos, refetchInterval: 60_000 });
  const navigate = useNavigate();
  return (
    <Sino total={data?.total ?? 0} rotulo="Mensagens da população">
      {(fechar) => (
        <div>
          <p className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold">Mensagens da população</p>
          {!data?.orgaos.length && <p className="p-4 text-sm text-slate-600">Nenhum órgão.</p>}
          <ul className="divide-y divide-slate-100">
            {data?.orgaos.map((o) => (
              <li key={o.orgaoId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    fechar();
                    navigate(`/admin/o/${o.orgaoId}/mensagens`);
                  }}
                >
                  <span className="text-slate-800">{o.orgaoNome}</span>
                  {o.mensagensNaoLidas > 0 ? (
                    <span className="rounded-full bg-red-600 px-2 text-xs font-bold text-white">{o.mensagensNaoLidas} nova(s)</span>
                  ) : (
                    <span className="text-xs text-slate-500">nenhuma nova</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sino>
  );
}

// Moldura do painel: cabecalho + menu lateral
export default function AdminLayout() {
  const { usuario, sair } = useAuth();
  const noOrgao = useMatch("/admin/o/:orgaoId/*");
  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="font-bold text-blue-800">
              Diário Digital — Painel
            </Link>
            {usuario.plataformaAdmin && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Administração GADZ</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
            <SeletorFonte />
            <SeletorTema />
            {!usuario.plataformaAdmin && <SinoPainel />}
            <span className="hidden text-slate-600 lg:inline">{usuario.nome}</span>
            <a href="/" target="_blank" rel="noreferrer" className="text-slate-600 hover:underline">
              Ver portal
            </a>
            <button onClick={sair} className="font-medium text-slate-700 hover:underline">
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
        {noOrgao?.params.orgaoId ? (
          <MenuOrgao orgaoId={noOrgao.params.orgaoId} />
        ) : (
          usuario.plataformaAdmin && <Menu itens={MENU_PLATAFORMA} />
        )}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

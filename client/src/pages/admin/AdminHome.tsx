import { Link, Navigate } from "react-router-dom";
import { Vazio } from "../../components/Estado";
import { LogoQuadro } from "../../components/Logo";
import { SeloSituacao } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { NOME_PAPEL } from "../../lib/formato";
import PainelPlataforma from "./plataforma/PainelPlataforma";

// /admin: superadmin ve o painel da plataforma; usuario de orgao vai para o painel do orgao
export default function AdminHome() {
  const { usuario, acessos } = useAuth();
  if (!usuario) return null;
  if (usuario.plataformaAdmin) return <PainelPlataforma />;

  // So um orgao: entra direto nele
  if (acessos.length === 1) return <Navigate to={`/admin/o/${acessos[0].orgaoId}`} replace />;

  return (
    <div>
      <h1 className="text-center text-2xl font-bold">Olá, {usuario.nome.split(" ")[0]}</h1>
      <p className="mt-1 text-center text-slate-600">Escolha o órgão que você quer acessar:</p>

      <div className="mt-5">
        {acessos.length === 0 ? (
          <Vazio texto="Você ainda não tem acesso a nenhum órgão. Fale com o administrador." />
        ) : (
          // Igual a tela do cidadao: computador lado a lado e centralizado; celular um embaixo do outro
          <ul className={`mx-auto grid grid-cols-1 gap-4 sm:gap-6 ${acessos.length > 1 ? "sm:max-w-3xl sm:grid-cols-2" : "sm:max-w-sm"}`}>
            {acessos.map((a) => (
              <li key={a.orgaoId}>
                <Link
                  to={`/admin/o/${a.orgaoId}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-400 hover:shadow"
                >
                  <LogoQuadro url={a.orgaoLogoUrl} nome={a.orgaoNome} />
                  <span className="flex flex-1 flex-col p-4">
                    <span className="flex flex-col items-center gap-1 text-center">
                      <span className="text-lg font-semibold leading-snug">{a.orgaoNome}</span>
                      <SeloSituacao situacao={a.situacao} />
                    </span>
                    <span className="mt-1 text-center text-sm text-slate-600">
                      {a.municipioNome}/{a.uf} · {NOME_PAPEL[a.papel]}
                    </span>
                    <span className="mt-auto pt-3">
                      <span className="block rounded-lg bg-blue-700 px-3 py-2 text-center text-sm font-medium text-white">
                        Acessar painel
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

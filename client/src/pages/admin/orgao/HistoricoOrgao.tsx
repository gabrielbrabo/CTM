import { useParams } from "react-router-dom";
import { orgaoApi } from "../../../api/orgao";
import { HistoricoLista } from "../../../components/Historico";

// Historico do orgao (so o administrador do orgao ve)
export default function HistoricoOrgao() {
  const { orgaoId = "" } = useParams();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-slate-600">
          Tudo o que foi feito neste órgão: publicações, anexos, usuários e configurações — quem fez e quando.
        </p>
      </div>
      <HistoricoLista chave={["orgao", orgaoId]} buscar={(f) => orgaoApi(orgaoId).historico(f)} />
    </div>
  );
}

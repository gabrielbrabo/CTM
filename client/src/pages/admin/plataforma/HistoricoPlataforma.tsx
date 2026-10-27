import { platformApi } from "../../../api/platform";
import { HistoricoLista } from "../../../components/Historico";

// Historico de TUDO o que acontece no sistema (visao da GADZ)
export default function HistoricoPlataforma() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-slate-600">
          Tudo o que foi feito no sistema: quem fez, o que fez e quando. Os registros não podem ser alterados nem apagados.
        </p>
      </div>
      <HistoricoLista chave={["plataforma"]} buscar={platformApi.historico} mostrarLocal />
    </div>
  );
}

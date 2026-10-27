import { DadosOrgaoForm } from "../../../api/platform";
import { SituacaoOrgao } from "../../../api/types";
import { AreaTexto, Campo, Secao, Selecao } from "../../../components/ui";

type Props = {
  valor: DadosOrgaoForm;
  onChange: (v: DadosOrgaoForm) => void;
  nomeSugerido?: string;
  tipo?: string; // "camara" mostra o campo do plenario
};

// Campos comuns de cadastro/edicao do orgao: dados, contato, responsavel e contrato
export default function CamposOrgao({ valor, onChange, nomeSugerido, tipo }: Props) {
  const set = <K extends keyof DadosOrgaoForm>(campo: K, v: DadosOrgaoForm[K]) => onChange({ ...valor, [campo]: v });
  const contatos = valor.contatos ?? {};
  const responsavel = valor.responsavel ?? {};
  const contrato = valor.contrato ?? {};

  return (
    <>
      <Secao titulo="Dados do órgão">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Nome do órgão"
            className="sm:col-span-2"
            value={valor.nome ?? ""}
            placeholder={nomeSugerido}
            dica={nomeSugerido ? `Se deixar em branco: “${nomeSugerido}”` : undefined}
            onChange={(e) => set("nome", e.target.value)}
          />
          <Campo label="Sigla" value={valor.sigla ?? ""} onChange={(e) => set("sigla", e.target.value)} />
          <Campo
            label="CNPJ"
            value={valor.cnpj ?? ""}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            onChange={(e) => set("cnpj", e.target.value)}
          />
          <Selecao
            label="Situação"
            value={valor.situacao ?? "ativo"}
            onChange={(e) => set("situacao", e.target.value as SituacaoOrgao)}
          >
            <option value="ativo">Ativo — aparece no portal</option>
            <option value="suspenso">Suspenso — fora do portal</option>
            <option value="encerrado">Encerrado — contrato finalizado</option>
          </Selecao>
          {tipo === "camara" && (
            <Campo
              label="Nome do plenário"
              className="sm:col-span-2"
              placeholder="ex.: Plenário Vereador José da Silva"
              dica="Aparece no portal e já preenche o local das sessões e audiências."
              value={valor.plenario ?? ""}
              onChange={(e) => set("plenario", e.target.value)}
            />
          )}
        </div>
      </Secao>

      <Secao titulo="Contrato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Número do contrato"
            value={contrato.numero ?? ""}
            onChange={(e) => set("contrato", { ...contrato, numero: e.target.value })}
          />
          <Campo
            label="Valor mensal (R$)"
            type="number"
            min="0"
            step="0.01"
            value={contrato.valorMensal ?? ""}
            onChange={(e) => set("contrato", { ...contrato, valorMensal: e.target.value })}
          />
          <Campo
            label="Início da vigência"
            type="date"
            value={contrato.inicio ?? ""}
            onChange={(e) => set("contrato", { ...contrato, inicio: e.target.value })}
          />
          <Campo
            label="Fim da vigência"
            type="date"
            value={contrato.fim ?? ""}
            onChange={(e) => set("contrato", { ...contrato, fim: e.target.value })}
          />
          <AreaTexto
            label="Observações"
            className="sm:col-span-2"
            value={contrato.observacoes ?? ""}
            onChange={(e) => set("contrato", { ...contrato, observacoes: e.target.value })}
          />
        </div>
      </Secao>

      <Secao titulo="Contato e responsável">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="E-mail do órgão"
            type="email"
            value={contatos.email ?? ""}
            onChange={(e) => set("contatos", { ...contatos, email: e.target.value })}
          />
          <Campo
            label="Telefone"
            value={contatos.telefone ?? ""}
            onChange={(e) => set("contatos", { ...contatos, telefone: e.target.value })}
          />
          <Campo
            label="Site oficial"
            value={contatos.site ?? ""}
            placeholder="https://"
            onChange={(e) => set("contatos", { ...contatos, site: e.target.value })}
          />
          <Campo
            label="Endereço"
            value={contatos.endereco ?? ""}
            onChange={(e) => set("contatos", { ...contatos, endereco: e.target.value })}
          />
          <Campo
            label="WhatsApp"
            value={contatos.whatsapp ?? ""}
            placeholder="(38) 99999-0000"
            onChange={(e) => set("contatos", { ...contatos, whatsapp: e.target.value })}
          />
          <Campo
            label="Horário de atendimento"
            value={contatos.horario ?? ""}
            placeholder="Segunda a sexta, 8h às 17h"
            onChange={(e) => set("contatos", { ...contatos, horario: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={valor.recebeMensagens !== false} onChange={(e) => set("recebeMensagens", e.target.checked)} />
            Recebe mensagens da população pelo portal (“Fale com...”)
          </label>
          <Campo
            label="Responsável (prefeito, presidente da câmara...)"
            value={responsavel.nome ?? ""}
            onChange={(e) => set("responsavel", { ...responsavel, nome: e.target.value })}
          />
          <Campo
            label="Cargo do responsável"
            value={responsavel.cargo ?? ""}
            onChange={(e) => set("responsavel", { ...responsavel, cargo: e.target.value })}
          />
        </div>
      </Secao>
    </>
  );
}

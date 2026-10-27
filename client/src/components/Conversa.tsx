import { formatarDataHora } from "../lib/formato";

/** Conversa de uma mensagem (balões: cidadao a esquerda, servidor a direita ou vice-versa) */
export function Conversa({
  respostas,
  ladoDireito,
}: {
  respostas: { autor: "cidadao" | "servidor"; nome: string; texto: string; data: string }[];
  ladoDireito: "cidadao" | "servidor"; // quem esta vendo fica a direita
}) {
  return (
    <ol className="space-y-3">
      {respostas.map((r, i) => {
        const direita = r.autor === ladoDireito;
        return (
          <li key={i} className={`flex ${direita ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                direita ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-xs font-semibold text-slate-600">
                {r.nome} {r.autor === "servidor" && <span className="font-normal">· órgão</span>}
              </p>
              <p className="mt-1 whitespace-pre-line text-slate-800">{r.texto}</p>
              <p className="mt-1 text-right text-xs text-slate-500">{formatarDataHora(r.data)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from "react";
import { SituacaoOrgao } from "../api/types";
import { COR_SITUACAO, NOME_SITUACAO } from "../lib/formato";

// Componentes pequenos reutilizados nos formularios do painel

const classeCampo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export function Campo({
  label,
  dica,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; dica?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {props.required && <span className="text-red-600"> *</span>}
      </label>
      <input id={id} className={classeCampo} {...props} />
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

export function Selecao({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {props.required && <span className="text-red-600"> *</span>}
      </label>
      <select id={id} className={classeCampo} {...props}>
        {children}
      </select>
    </div>
  );
}

export function AreaTexto({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea id={id} rows={3} className={classeCampo} {...props} />
    </div>
  );
}

export function Secao({ titulo, children, acoes }: { titulo: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-800">{titulo}</h2>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" }) {
  const cores = {
    primario: "bg-blue-700 text-white hover:bg-blue-800",
    secundario: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    perigo: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variante];
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${cores} ${className}`}
      {...props}
    />
  );
}

export function SeloSituacao({ situacao }: { situacao: SituacaoOrgao }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO[situacao]}`}>
      {NOME_SITUACAO[situacao]}
    </span>
  );
}

export function Aviso({ tipo, children }: { tipo: "erro" | "sucesso"; children: ReactNode }) {
  const cor = tipo === "erro" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800";
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${cor}`}>
      {children}
    </div>
  );
}

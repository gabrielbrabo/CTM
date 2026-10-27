// Mensagens padrao de carregando / erro / vazio

export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <p role="status" className="py-8 text-center text-slate-500">
      {texto}
    </p>
  );
}

export function Erro({ texto, onTentar }: { texto: string; onTentar?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p>{texto}</p>
      {onTentar && (
        <button onClick={onTentar} className="mt-2 text-sm font-medium underline">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">{texto}</p>;
}

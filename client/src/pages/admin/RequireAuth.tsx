import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Carregando, Erro } from "../../components/Estado";
import { useAuth } from "../../context/AuthContext";

// Protege as telas do painel: sem login vai para /admin/login
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <Carregando texto="Verificando sessão..." />;
  if (!usuario) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

// So superadmin da plataforma (GADZ)
export function RequirePlataforma({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario?.plataformaAdmin) return <Erro texto="Esta área é exclusiva da administração da plataforma." />;
  return <>{children}</>;
}

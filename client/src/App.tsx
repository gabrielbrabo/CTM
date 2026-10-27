import { ReactElement } from "react";
import { Link, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import PublicLayout from "./components/PublicLayout";
import AdminHome from "./pages/admin/AdminHome";
import Login from "./pages/admin/Login";
import OrgaoInicio from "./pages/admin/orgao/OrgaoInicio";
import PublicacaoEditor from "./pages/admin/orgao/PublicacaoEditor";
import PublicacoesLista from "./pages/admin/orgao/PublicacoesLista";
import UsuariosOrgao from "./pages/admin/orgao/UsuariosOrgao";
import HistoricoOrgao from "./pages/admin/orgao/HistoricoOrgao";
import VereadoresOrgao from "./pages/admin/orgao/VereadoresOrgao";
import MensagensOrgao from "./pages/admin/orgao/MensagensOrgao";
import MensagemOrgaoPage from "./pages/admin/orgao/MensagemOrgao";
import HistoricoPlataforma from "./pages/admin/plataforma/HistoricoPlataforma";
import Municipios from "./pages/admin/plataforma/Municipios";
import OrgaoDetalhe from "./pages/admin/plataforma/OrgaoDetalhe";
import OrgaoNovo from "./pages/admin/plataforma/OrgaoNovo";
import OrgaosLista from "./pages/admin/plataforma/OrgaosLista";
import Usuarios from "./pages/admin/plataforma/Usuarios";
import RequireAuth, { RequirePlataforma } from "./pages/admin/RequireAuth";
import MunicipioPage from "./pages/public/MunicipioPage";
import OrgaoPage from "./pages/public/OrgaoPage";
import PublicacaoPage from "./pages/public/PublicacaoPage";
import SelecionarMunicipio from "./pages/public/SelecionarMunicipio";
import EntrarPage from "./pages/cidadao/EntrarPage";
import MensagemCidadaoPage from "./pages/cidadao/MensagemCidadaoPage";
import MinhaContaPage from "./pages/cidadao/MinhaContaPage";
import VereadorPage from "./pages/public/VereadorPage";
import VereadoresPage from "./pages/public/VereadoresPage";

function NaoEncontrada() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <Link to="/" className="mt-4 inline-block text-blue-700 hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}

// Envolve uma tela exclusiva do superadmin
const soPlataforma = (el: ReactElement) => <RequirePlataforma>{el}</RequirePlataforma>;

export default function App() {
  return (
    <Routes>
      {/* Painel (vem antes do /:slug para nao ser confundido com um municipio) */}
      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="orgaos" element={soPlataforma(<OrgaosLista />)} />
        <Route path="orgaos/novo" element={soPlataforma(<OrgaoNovo />)} />
        <Route path="orgaos/:id" element={soPlataforma(<OrgaoDetalhe />)} />
        <Route path="municipios" element={soPlataforma(<Municipios />)} />
        <Route path="usuarios" element={soPlataforma(<Usuarios />)} />
        <Route path="historico" element={soPlataforma(<HistoricoPlataforma />)} />

        {/* Painel do orgao (Prefeitura/Camara) */}
        <Route path="o/:orgaoId" element={<OrgaoInicio />} />
        <Route path="o/:orgaoId/publicacoes" element={<PublicacoesLista />} />
        <Route path="o/:orgaoId/publicacoes/nova" element={<PublicacaoEditor key="nova" />} />
        <Route path="o/:orgaoId/publicacoes/:id" element={<PublicacaoEditor />} />
        <Route path="o/:orgaoId/usuarios" element={<UsuariosOrgao />} />
        <Route path="o/:orgaoId/historico" element={<HistoricoOrgao />} />
        <Route path="o/:orgaoId/vereadores" element={<VereadoresOrgao />} />
        <Route path="o/:orgaoId/mensagens" element={<MensagensOrgao />} />
        <Route path="o/:orgaoId/mensagens/:id" element={<MensagemOrgaoPage />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>

      {/* Portal publico: municipio -> orgao */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<SelecionarMunicipio />} />
        {/* Conta da populacao */}
        <Route path="/entrar" element={<EntrarPage />} />
        <Route path="/minha-conta" element={<MinhaContaPage />} />
        <Route path="/minha-conta/mensagens/:id" element={<MensagemCidadaoPage />} />
        <Route path="/:slug" element={<MunicipioPage />} />
        <Route path="/:slug/p/:pubSlug" element={<PublicacaoPage />} />
        <Route path="/:slug/camara/vereadores" element={<VereadoresPage />} />
        <Route path="/:slug/vereadores/:id" element={<VereadorPage />} />
        <Route path="/:slug/:orgao" element={<OrgaoPage />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  );
}

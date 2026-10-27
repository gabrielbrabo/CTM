import { Request, Response, Router } from "express";
import { Orgao } from "../../models/Orgao";

// Montado em /api/admin/m/:municipioId/orgaos (protect + municipioAdmin ja rodaram)
// Cadastro e edicao de orgaos contratantes ficam na area da plataforma (GADZ).
const router = Router({ mergeParams: true });

// GET -> orgaos do municipio (o plugin filtra pelo municipio do contexto)
router.get("/", async (_req: Request, res: Response) => {
  const orgaos = await Orgao.find().select("tipo nome sigla situacao parentId").sort({ tipo: 1, nome: 1 });
  res.json(orgaos);
});

export default router;

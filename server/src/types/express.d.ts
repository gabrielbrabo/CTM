import type { CidadaoDoc } from "../models/Cidadao";
import type { MunicipioDoc } from "../models/Municipio";
import type { OrgaoDoc } from "../models/Orgao";
import type { UsuarioDoc } from "../models/Usuario";

// Campos extras que os middlewares colocam no req
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioDoc;
      municipio?: MunicipioDoc;
      orgao?: OrgaoDoc;
      cidadao?: CidadaoDoc; // conta da populacao (portal)
    }
  }
}

export {};

# Diário Digital de Transparência Municipal (CTM)

Portal em que a população escolhe o **município** → **Prefeitura ou Câmara** → vê as publicações e documentos.

```
CTM/
├── server/   API (Node + TypeScript + Express + MongoDB/Mongoose)
└── client/   Site (React + Vite + TypeScript + Tailwind)
```

## 1. Primeira vez (PowerShell)

```powershell
cd "C:\Users\G. S. Gama\Documents\CTM"
npm run instalar
```

Configure os arquivos `.env`:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Em `server\.env` preencha:
- `MONGO_URI` → string do MongoDB Atlas (crie um banco chamado `ctm`)
- `JWT_SECRET` e `JWT_REFRESH_SECRET` → dois textos longos e diferentes
- `SEED_ADMIN_EMAIL` e `SEED_ADMIN_SENHA` → seu login de superadmin

Crie o seu usuário de superadmin (GADZ):

```powershell
npm run seed
```

### Usuário de teste como administrador de órgão

```powershell
npm run orgao:teste
```

Cria (ou reaproveita) a **Câmara de "Município Teste"/MG** e o login **camara@teste.com / camara12345** como administrador do órgão. Para escolher os dados, rode dentro da pasta `server`:

```powershell
cd server
npm run orgao:teste -- --municipio "São Romão" --uf MG --tipo camara --email voce@teste.com --senha suasenha123 --nome "Seu Nome"
```

Use um e-mail diferente do superadmin. Pode rodar várias vezes: não duplica e redefine a senha.

## 2. Rodar

```powershell
npm run dev
```

- Site: http://localhost:5173
- Painel: http://localhost:5173/admin
- API: http://localhost:4000/api/health

## 3. Testes e tipos

```powershell
npm test          # testes de isolamento entre municipios (baixa um MongoDB temporario na 1a vez)
npm run typecheck # tsc --noEmit no server e no client
```

## Como o cadastro funciona

- **Superadmin (GADZ):** entra em `/admin` com o usuário do seed. Tem menu com Painel, Órgãos, Municípios e Usuários.
- **Órgão = cliente.** Prefeitura e Câmara são cadastradas **separadamente** (“Novo órgão”), cada uma com seu CNPJ, contrato e administrador. Um município pode ter só a Câmara, só a Prefeitura ou as duas.
- **Município** é criado junto com o primeiro órgão daquela cidade. Só aparece no portal se tiver pelo menos um órgão **ativo**.
- **Situação do órgão:** Ativo (aparece no portal), Suspenso ou Encerrado (somem do portal).
- **Painel do órgão** (`/admin/o/:orgaoId`): o usuário do órgão entra direto nele. Menu Início, Publicações e Usuários (só administrador).
- **Papéis no órgão:** Administrador (usuários, configurações, despublicar), Editor (cria/edita), Revisor (revisa e publica).
- **Fluxo das publicações:** rascunho → publicar. Se o órgão ligar “Exigir revisão”, o editor envia para revisão e só revisor/administrador publica. Corrigir algo já publicado exige motivo (fica visível no portal). Despublicar exige motivo.
- **Tipos de publicação por órgão** (`server/src/config/tiposPublicacao.ts`, 44 tipos, cada um com campos e cor próprios):
  - **Câmara:** projeto de lei, indicação, requerimento, moção, resolução, decreto legislativo, emenda à Lei Orgânica, decreto de aprovação de contas, prestação de contas do Legislativo, sessão/pauta, ata, votação e parecer.
  - **Prefeitura:** decreto, licitação, obra, programa/serviço, prestação de contas do Executivo, patrimônio cultural, educação infantil (CEMEI) e conselhos municipais (CME / CACS-FUNDEB...).
  - **Os dois:** lei, portaria, ato administrativo, instrução normativa, deliberação, regimento interno, convênio, contrato, termo de ajustamento de conduta, processo administrativo, licença-prêmio, concurso público, processo seletivo, chamada pública, editais de convocação/estágio/seleção, audiência pública, notícia, comunicado, aviso, documento e publicações diversas.
  - Para criar um tipo novo, basta acrescentar no catálogo (o formulário, a validação, a ficha do portal e o filtro se montam sozinhos).
- **Criar a partir de um arquivo:** no editor, envie PDF, Word (.docx/.doc), ODT, TXT ou foto/imagem do documento; o texto é extraído (imagens por OCR em português, sem internet) e vai para o “Texto completo”. Opcionalmente o arquivo original vira anexo. PDF escaneado (sem texto) ou a opção “Mostrar o documento no lugar do texto” exibem o próprio arquivo (imagem ou páginas do PDF) no portal, no lugar do texto.
- **Vereadores (só Câmara):** menu “Vereadores” no painel. O administrador cadastra foto, nome, nome parlamentar, partido, cargo na Mesa, situação (em exercício, licenciado, suplente, ex), mandato, contatos e biografia. Eles **não acessam** o sistema. Nas publicações da Câmara escolhe-se: **autores** (projeto de lei, indicação, requerimento, moção), **relator** (parecer), **votação nominal** (votação, projeto de lei, requerimento, moção — a contagem é calculada sozinha) e **presença** (sessão, ata). No portal: botão “Conheça os vereadores” na página da Câmara, perfil de cada um com proposições de autoria, como votou e presença; a publicação mostra autores, votos e presença. Quem já está em alguma publicação não pode ser excluído (marque como “Ex-vereador”).
- **Depois de publicar:** o editor volta para a lista de publicadas com aviso, link “Ver no portal” e botão de imprimir.
- **Impressão:** botão “Imprimir” no portal e no painel gera um PDF pronto para imprimir/salvar — “Somente a publicação” ou “Somente os anexos” (junta os anexos em PDF e as imagens JPG/PNG).
- **Logos:** brasão do município (GADZ: Municípios → “Brasão”) aparece na lista de municípios; logo do órgão (GADZ: Órgãos → órgão, ou o administrador do órgão na tela Início) aparece em quadro em cima do nome. PNG/JPG/WEBP até 2 MB; sem logo, mostra as iniciais.
- **Navegação do portal:** município em linha inteira com botão “Acessar”; Prefeitura e Câmara lado a lado; botões “Voltar” em todas as telas.
- **Cores por tipo:** cada tipo de publicação tem uma cor (campo `cor` no catálogo), usada na etiqueta e na faixa da lista, no portal e no painel. Acima da lista, etiquetas mostram quantas publicações há de cada tipo; clicar filtra.
- **Baixar documentos:** os anexos aparecem para baixar direto na lista e no topo da página da publicação.
- **Publicação repetida:** o sistema não deixa cadastrar duas vezes o mesmo tipo + número (ou o mesmo título, sem número) no órgão; para mudar a situação ou lançar a votação, edita-se a existente.
- **Tamanho da letra:** botões A− / A / A+ no topo, ao lado do tema; a escolha fica salva no navegador.
- **Tema claro/escuro:** seletor no topo (Claro, Escuro, Automático = segue o aparelho); a escolha fica salva no navegador. Cores escuras em `client/src/tema.css`.
- **Anexos:** PDF, imagem, Word, Excel, ODT, CSV e TXT até 20 MB. Sem `S3_BUCKET` no `.env`, ficam em `server/uploads`.

## Como o isolamento entre municípios funciona

- Todo dado de município tem o campo `municipioId`.
- `server/src/plugins/tenantScope.ts` é aplicado nos models: se uma consulta esquecer o `municipioId`, **dá erro** em vez de devolver dados de todos.
- O município da requisição é definido uma vez pelo middleware (`server/src/middleware/municipio.ts`) e o plugin aplica o filtro sozinho.
- `server/tests/` tem os testes de acesso cruzado: rode `npm test` sempre que mexer em rotas.

**Regra para novos models de município:** adicionar `municipioId` + `schema.plugin(tenantScope)`.

## Rotas da API

| Rota | Acesso |
|---|---|
| `GET /api/public/municipios` | público |
| `GET /api/public/m/:slug` | público (município + órgãos) |
| `POST /api/auth/login`, `/refresh`, `/logout`, `GET /api/auth/me` | login |
| `GET /api/admin/m/:municipioId/orgaos` | usuário com vínculo no município |
| `GET /api/public/m/:slug/feed`, `/p/:pubSlug`, `/p/:pubSlug/anexos/:id`, `/p/:pubSlug/impressao.pdf[?anexos=1]` | público (só publicado) |
| `/api/admin/o/:orgaoId` (painel, config, usuarios, publicacoes, anexos) | usuário do órgão |
| `/api/platform/*` (resumo, municipios, orgaos, orgaos/:id/usuarios, usuarios) | superadmin GADZ |

Documentação de arquitetura: Projeto "Centro de Transparência Municipal" (`claude/arquitetura.md`).

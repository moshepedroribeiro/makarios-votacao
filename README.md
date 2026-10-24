# Makários · Sistema de votação

Sistema web da eleição bienal de presidente e vice-presidente do Motoclube Makários: cadastro dos membros full patch, eleição com mesa, deferimento automático das candidaturas, votação online secreta (cerca de 30 minutos), apuração com a regra de cidade do vice e os desempates do estatuto, lista de presença e ata em PDF.

- `apps/api` — Node.js + NestJS + SQLite (better-sqlite3). Todas as regras ficam aqui.
- `apps/web` — Next.js 14 (App Router) + React + Tailwind CSS.

## Como rodar

Requer Node.js 20 ou mais novo.

```bash
npm install          # na raiz; instala os dois apps
npm run demo         # opcional: 12 membros fictícios + usuário de mesa "paulo" / "paulo123"
npm run build

# em dois terminais
npm run start:api    # http://localhost:8080/api
npm run start:web    # http://localhost:3002
```

Para desenvolvimento, use `npm run dev:api` e `npm run dev:web`.

Na primeira execução é criado o administrador `admin` com a senha `makarios123` (ou os valores de `ADMIN_LOGIN` / `ADMIN_SENHA`). **Troque em produção.** Veja `apps/api/.env.example` e `apps/web/.env.example`.

Testes das regras e do fluxo completo: `npm test`.

## Passo a passo de uma eleição

1. **Administrador → Membros:** cadastre (ou importe a planilha CSV) todos os membros full patch.
2. **Administrador → Usuários:** crie um usuário de perfil *Mesa* para o presidente de sessão (e para os mesários), vinculado ao cadastro de membro de cada um.
3. **Administrador → Eleições → Criar eleição:** título, início (o término é sugerido 30 minutos depois), presidente de sessão e mesários.
4. **Candidaturas:** o administrador ou o presidente de sessão registra os candidatos. O sistema defere ou indefere na hora e mostra o motivo.
5. **Agendar eleição:** fecha a lista de aptos. Até a abertura, a mesa ainda pode incluir quem ficou apto depois.
6. No horário de início a votação **abre sozinha**. Cada membro acessa `/votar` no celular, entra só com o CPF e vota.
7. **Painel da mesa:** contagem regressiva, quantos já votaram, quem falta e inclusão na lista de quem ficou apto antes da abertura.
8. No horário de término a votação **encerra sozinha** (ou antes, pelo presidente de sessão, se todos os aptos já votaram).
9. **Apuração** (presidente de sessão): mostra presidente e vice. Se houver empate na vaga de vice, o presidente de sessão registra quem o presidente eleito escolheu.
10. **PDFs:** lista de presença (ordem alfabética, sem horário e sem voto) e ata da apuração.

## Regras implementadas

| Regra | Onde |
| --- | --- |
| Fechamento só com coleteamento; datas opcionais | `MembrosService.validar` e `CHECK` no banco |
| Apto a votar = ativo + colete fechado + habilitado | `regras.ts › aptidao` |
| UF sempre derivada da cidade, em maiúsculo | `MembrosService.validar` |
| Candidatura deferida: 3 anos de colete fechado até o início da eleição, não compõe a mesa, habilitado, uma por eleição | `EleicoesService.motivoIndeferimento` |
| Mesa e candidatura bloqueadas nos dois sentidos | `EleicoesService.validarMesa` e `motivoIndeferimento` |
| Presidente = mais votado; empate → o mais velho | `regras.ts › apurar` |
| Vice = mais votado de outra cidade; empate → escolha do presidente eleito; ninguém de outra cidade → vago | `regras.ts › apurar` |
| Empate para presidente com mesma data de nascimento → sistema não decide (nova votação) | `regras.ts › apurar` |
| Abertura e encerramento automáticos pelo horário | `EleicoesService.atualizarStatusPorHorario` |
| Encerramento antecipado só com todos os aptos votando | `EleicoesService.encerrar` |

## Sigilo do voto

- A tabela `voto` guarda só eleição e candidato: **sem membro, sem data/hora, sem número sequencial**. A chave é um UUID aleatório e a tabela é `WITHOUT ROWID`, então a ordem física não revela a ordem dos votos.
- A tabela `presenca` guarda só eleição e membro, sem horário, também `WITHOUT ROWID`.
- Presença e voto são gravados na mesma transação; nenhum aponta para o outro.
- A sessão de votação (que sabe quem está votando) vive só na memória da API e é descartada ao votar.
- O acesso à votação é só pelo CPF, que precisa estar na lista de aptos da eleição. A rota de entrada aceita no máximo 15 tentativas por minuto por IP.
- Nenhum total aparece antes da apuração; a API não registra o corpo das requisições em log.

## Diferença em relação ao descritivo

O descritivo previa Prisma como ORM. O código usa **better-sqlite3** com migrações SQL próprias (`apps/api/src/db/migrations.ts`), porque o Prisma não permite declarar `WITHOUT ROWID`, que é parte da garantia de sigilo. A lista de cidades fica em `regras.ts` (API) e `lib/formato.ts` (front).

## Produção

- Rode atrás de HTTPS (por exemplo Nginx ou Caddy na frente do Next na porta 3002). Só o Next precisa ficar exposto; ele repassa `/api` para a API.
- Defina `JWT_SECRET`, `ADMIN_SENHA` e `NODE_ENV=production`.
- Faça backup de `apps/api/data/makarios.db` após cada eleição.
- Rode uma única instância da API (as sessões de votação ficam em memória).

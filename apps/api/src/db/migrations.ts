/**
 * Migrações versionadas do banco SQLite.
 *
 * SIGILO DO VOTO — não altere sem entender:
 *  - `voto` não tem membro, data, hora nem número sequencial. A chave é um
 *    UUID aleatório e a tabela é WITHOUT ROWID, então as linhas ficam
 *    ordenadas pelo UUID (aleatório) e não pela ordem de gravação.
 *  - `presenca` não tem data/hora e também é WITHOUT ROWID.
 *  - Nenhuma das duas referencia a outra.
 */
export interface Migracao {
  versao: number;
  nome: string;
  sql: string;
}

export const MIGRACOES: Migracao[] = [
  {
    versao: 1,
    nome: 'inicial',
    sql: `
CREATE TABLE membro (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nome              TEXT    NOT NULL,
  cpf               TEXT    NOT NULL UNIQUE,
  data_nascimento   TEXT    NOT NULL,
  data_entrada      TEXT    NOT NULL,
  data_coleteamento TEXT,
  data_fechamento   TEXT,
  cidade            TEXT    NOT NULL CHECK (cidade IN ('Cascavel','Toledo','Nova Santa Rosa','Marechal Cândido Rondon','Vilhena')),
  uf                TEXT    NOT NULL CHECK (uf IN ('PR','RO')),
  habilitado        INTEGER NOT NULL DEFAULT 1,
  ativo             INTEGER NOT NULL DEFAULT 1,
  criado_em         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (data_fechamento IS NULL OR data_coleteamento IS NOT NULL),
  CHECK (data_coleteamento IS NULL OR data_coleteamento >= data_entrada),
  CHECK (data_fechamento IS NULL OR data_fechamento >= data_coleteamento)
);

CREATE TABLE usuario (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  login      TEXT    NOT NULL UNIQUE,
  senha_hash TEXT    NOT NULL,
  perfil     TEXT    NOT NULL CHECK (perfil IN ('ADMIN','MESA')),
  membro_id  INTEGER REFERENCES membro(id),
  ativo      INTEGER NOT NULL DEFAULT 1,
  criado_em  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE historico_habilitacao (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  membro_id    INTEGER NOT NULL REFERENCES membro(id),
  habilitado   INTEGER NOT NULL,
  motivo       TEXT    NOT NULL,
  alterado_por TEXT    NOT NULL,
  alterado_em  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE eleicao (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo               TEXT    NOT NULL,
  inicio               TEXT    NOT NULL,
  termino              TEXT    NOT NULL,
  status               TEXT    NOT NULL DEFAULT 'rascunho'
                       CHECK (status IN ('rascunho','agendada','aberta','encerrada','aguardando_vice','apurada')),
  presidente_sessao_id INTEGER REFERENCES membro(id),
  presidente_eleito_id INTEGER REFERENCES membro(id),
  vice_eleito_id       INTEGER REFERENCES membro(id),
  criterio_presidente  TEXT,
  criterio_vice        TEXT,
  apurada_em           TEXT,
  criado_em            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (termino > inicio)
);

CREATE TABLE eleicao_mesario (
  eleicao_id INTEGER NOT NULL REFERENCES eleicao(id) ON DELETE CASCADE,
  membro_id  INTEGER NOT NULL REFERENCES membro(id),
  PRIMARY KEY (eleicao_id, membro_id)
);

CREATE TABLE candidatura (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  eleicao_id INTEGER NOT NULL REFERENCES eleicao(id) ON DELETE CASCADE,
  membro_id  INTEGER NOT NULL REFERENCES membro(id),
  apelido    TEXT,
  situacao   TEXT    NOT NULL CHECK (situacao IN ('deferida','indeferida')),
  motivo     TEXT,
  UNIQUE (eleicao_id, membro_id)
);

CREATE TABLE credencial_votacao (
  eleicao_id    INTEGER NOT NULL REFERENCES eleicao(id) ON DELETE CASCADE,
  membro_id     INTEGER NOT NULL REFERENCES membro(id),
  codigo_hash   TEXT    NOT NULL,
  tentativas    INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT,
  PRIMARY KEY (eleicao_id, membro_id)
);

-- Sem timestamp, de propósito.
CREATE TABLE presenca (
  eleicao_id INTEGER NOT NULL REFERENCES eleicao(id) ON DELETE CASCADE,
  membro_id  INTEGER NOT NULL REFERENCES membro(id),
  PRIMARY KEY (eleicao_id, membro_id)
) WITHOUT ROWID;

-- Sem membro, sem timestamp, chave UUID aleatória.
CREATE TABLE voto (
  id             TEXT    NOT NULL PRIMARY KEY,
  eleicao_id     INTEGER NOT NULL REFERENCES eleicao(id) ON DELETE CASCADE,
  candidatura_id INTEGER NOT NULL REFERENCES candidatura(id)
) WITHOUT ROWID;

CREATE TABLE resultado_candidato (
  eleicao_id     INTEGER NOT NULL REFERENCES eleicao(id) ON DELETE CASCADE,
  candidatura_id INTEGER NOT NULL REFERENCES candidatura(id),
  total_votos    INTEGER NOT NULL,
  posicao        INTEGER NOT NULL,
  PRIMARY KEY (eleicao_id, candidatura_id)
);

CREATE INDEX idx_voto_eleicao ON voto(eleicao_id, candidatura_id);
CREATE UNIQUE INDEX idx_uma_eleicao_aberta ON eleicao(status) WHERE status = 'aberta';
`,
  },
  {
    versao: 2,
    nome: 'acesso-so-por-cpf',
    // O votante entra só com o CPF: a credencial vira apenas a lista de aptos da eleição.
    sql: `
ALTER TABLE credencial_votacao DROP COLUMN codigo_hash;
ALTER TABLE credencial_votacao DROP COLUMN tentativas;
ALTER TABLE credencial_votacao DROP COLUMN bloqueado_ate;
ALTER TABLE credencial_votacao RENAME TO apto_eleicao;
`,
  },
];

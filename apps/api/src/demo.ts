import 'dotenv/config';
/**
 * Popula o banco com dados de demonstração (membros fictícios e um usuário
 * de mesa). Uso: npm run demo   — não use em produção.
 */
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from './db/database.service';

function cpf(base9: string): string {
  const dv = (s: string, p: number) => {
    let t = 0;
    for (let i = 0; i < s.length; i++) t += Number(s[i]) * (p - i);
    const r = (t * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base9, 10);
  return base9 + d1 + dv(base9 + d1, 11);
}

const MEMBROS: [string, string, string, string | null, string | null][] = [
  // nome, cidade, nascimento, coleteamento, fechamento
  ['Roberto Almeida', 'Cascavel', '1968-04-12', '2008-03-01', '2009-03-01'],
  ['Marcos Vinícius Kunz', 'Toledo', '1975-09-30', '2012-05-10', '2013-06-15'],
  ['Anderson Schmitt', 'Toledo', '1980-01-22', '2014-02-01', '2015-02-01'],
  ['Clóvis Rauber', 'Marechal Cândido Rondon', '1972-11-05', '2010-08-01', '2011-08-20'],
  ['Elton Becker', 'Nova Santa Rosa', '1983-06-18', '2016-01-10', '2017-03-04'],
  ['Josué Ferreira', 'Vilhena', '1979-03-03', '2013-04-01', '2014-04-01'],
  ['Valdir Santos', 'Vilhena', '1985-12-12', '2019-07-01', '2020-07-01'],
  ['Paulo Henrique Dias', 'Cascavel', '1966-02-14', '2005-01-01', '2006-01-01'],
  ['Leandro Moura', 'Cascavel', '1990-08-08', '2023-02-01', '2024-11-10'],
  ['Rafael Königs', 'Toledo', '1993-10-10', '2025-05-01', null],
  ['Diego Lunardi', 'Marechal Cândido Rondon', '1995-05-05', null, null],
  ['Sérgio Peretti', 'Cascavel', '1977-07-07', '2011-01-01', '2012-01-01'],
];

const db = new DatabaseService();
if (db.get('SELECT 1 FROM membro')) {
  console.log('O banco já tem membros; demonstração não aplicada.');
  process.exit(0);
}
db.tx(() => {
  MEMBROS.forEach(([nome, cidade, nasc, col, fec], i) => {
    db.run(
      `INSERT INTO membro (nome, cpf, data_nascimento, data_entrada, data_coleteamento, data_fechamento, cidade, uf)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      nome,
      cpf(String(310000000 + i * 7919)),
      nasc,
      col ? `${Number(col.slice(0, 4)) - 1}${col.slice(4)}` : '2024-01-01',
      col,
      fec,
      cidade,
      cidade === 'Vilhena' ? 'RO' : 'PR',
    );
  });
  const ps = db.get<{ id: number }>(`SELECT id FROM membro WHERE nome = 'Paulo Henrique Dias'`)!;
  db.run(`INSERT INTO usuario (login, senha_hash, perfil, membro_id) VALUES ('paulo', ?, 'MESA', ?)`, bcrypt.hashSync('paulo123', 10), ps.id);
  const sergio = db.get<{ id: number }>(`SELECT id FROM membro WHERE nome = 'Sérgio Peretti'`)!;
  db.run(`UPDATE membro SET habilitado = 0 WHERE id = ?`, sergio.id);
  db.run(
    `INSERT INTO historico_habilitacao (membro_id, habilitado, motivo, alterado_por) VALUES (?, 0, 'Mensalidades em atraso (demonstração)', 'admin')`,
    sergio.id,
  );
});
console.log('Demonstração criada: 12 membros e o usuário de mesa "paulo" (senha paulo123), vinculado a Paulo Henrique Dias.');
console.log('CPFs dos membros:');
for (const m of db.all<any>('SELECT nome, cpf FROM membro ORDER BY nome')) console.log(`  ${m.cpf}  ${m.nome}`);

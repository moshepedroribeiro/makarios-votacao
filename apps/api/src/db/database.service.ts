import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MIGRACOES } from './migrations';

/**
 * Acesso ao SQLite. Usa better-sqlite3 (síncrono), o que torna as transações
 * simples e atômicas: `db.tx(() => { ... })`.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger('Banco');
  readonly conn: Database.Database;

  constructor() {
    const arquivo = process.env.DATABASE_FILE ?? path.resolve(process.cwd(), 'data', 'makarios.db');
    if (arquivo !== ':memory:') fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    this.conn = new Database(arquivo);
    this.conn.pragma('journal_mode = WAL');
    this.conn.pragma('foreign_keys = ON');
    // Sobrescreve páginas apagadas com zeros (não deixa restos no arquivo).
    this.conn.pragma('secure_delete = ON');
    this.migrar();
  }

  private migrar() {
    this.conn.exec(`CREATE TABLE IF NOT EXISTS _migracao (versao INTEGER PRIMARY KEY, nome TEXT NOT NULL)`);
    const aplicadas = new Set(
      (this.conn.prepare('SELECT versao FROM _migracao').all() as { versao: number }[]).map((r) => r.versao),
    );
    for (const m of MIGRACOES) {
      if (aplicadas.has(m.versao)) continue;
      this.tx(() => {
        this.conn.exec(m.sql);
        this.conn.prepare('INSERT INTO _migracao (versao, nome) VALUES (?, ?)').run(m.versao, m.nome);
      });
      this.logger.log(`Migração ${m.versao} (${m.nome}) aplicada`);
    }
  }

  all<T = any>(sql: string, ...params: any[]): T[] {
    return this.conn.prepare(sql).all(...params) as T[];
  }

  get<T = any>(sql: string, ...params: any[]): T | undefined {
    return this.conn.prepare(sql).get(...params) as T | undefined;
  }

  run(sql: string, ...params: any[]) {
    return this.conn.prepare(sql).run(...params);
  }

  tx<T>(fn: () => T): T {
    return this.conn.transaction(fn)();
  }

  onModuleDestroy() {
    this.conn.close();
  }
}

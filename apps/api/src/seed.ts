import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from './db/database.service';

/** Cria o primeiro administrador se ainda não houver nenhum. */
export function garantirAdmin(app: INestApplication) {
  const db = app.get(DatabaseService);
  if (db.get(`SELECT 1 FROM usuario WHERE perfil = 'ADMIN'`)) return;
  const login = (process.env.ADMIN_LOGIN ?? 'admin').toLowerCase();
  const senha = process.env.ADMIN_SENHA ?? 'makarios123';
  db.run(`INSERT INTO usuario (login, senha_hash, perfil) VALUES (?, ?, 'ADMIN')`, login, bcrypt.hashSync(senha, 10));
  console.warn(`Administrador inicial criado: login "${login}". Troque a senha padrão em produção (ADMIN_SENHA).`);
}

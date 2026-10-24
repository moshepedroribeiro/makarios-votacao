import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { IsIn, IsInt, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { SoAdmin } from '../auth/auth';
import { DatabaseService } from '../db/database.service';

class CriarUsuarioDto {
  @IsString() @Matches(/^[a-z0-9._-]{3,30}$/i, { message: 'Login: 3 a 30 letras, números, ponto, hífen ou _' })
  login!: string;
  @IsString() @MinLength(6, { message: 'A senha precisa de ao menos 6 caracteres' }) senha!: string;
  @IsIn(['ADMIN', 'MESA']) perfil!: 'ADMIN' | 'MESA';
  @IsOptional() @IsInt() membroId?: number;
}

@SoAdmin()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  listar() {
    return this.db.all(
      `SELECT u.id, u.login, u.perfil, u.membro_id AS membroId, m.nome AS membroNome, u.ativo
         FROM usuario u LEFT JOIN membro m ON m.id = u.membro_id ORDER BY u.login`,
    );
  }

  @Post()
  criar(@Body() dto: CriarUsuarioDto) {
    if (dto.perfil === 'MESA' && !dto.membroId) {
      throw new BadRequestException('Usuários da mesa precisam estar vinculados a um membro.');
    }
    const login = dto.login.trim().toLowerCase();
    if (this.db.get('SELECT 1 FROM usuario WHERE login = ?', login)) {
      throw new BadRequestException('Já existe um usuário com esse login.');
    }
    if (dto.membroId && !this.db.get('SELECT 1 FROM membro WHERE id = ?', dto.membroId)) {
      throw new BadRequestException('Membro não encontrado.');
    }
    const r = this.db.run(
      'INSERT INTO usuario (login, senha_hash, perfil, membro_id) VALUES (?, ?, ?, ?)',
      login,
      bcrypt.hashSync(dto.senha, 10),
      dto.perfil,
      dto.membroId ?? null,
    );
    return { id: r.lastInsertRowid };
  }

  @Delete(':id')
  desativar(@Param('id', ParseIntPipe) id: number) {
    const admins = this.db.get<{ n: number }>(`SELECT COUNT(*) n FROM usuario WHERE perfil='ADMIN' AND ativo=1 AND id <> ?`, id)!;
    const alvo = this.db.get<any>('SELECT perfil FROM usuario WHERE id = ?', id);
    if (alvo?.perfil === 'ADMIN' && admins.n === 0) {
      throw new BadRequestException('Não é possível desativar o último administrador.');
    }
    this.db.run('UPDATE usuario SET ativo = 0 WHERE id = ?', id);
    return { ok: true };
  }
}

import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { DatabaseService } from '../db/database.service';
import { COOKIE_TOKEN, Publico, Usuario, UsuarioLogado } from './auth';

class LoginDto {
  @IsString() login!: string;
  @IsString() @MinLength(1) senha!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const u = this.db.get<any>(
      `SELECT u.*, m.nome AS membro_nome FROM usuario u LEFT JOIN membro m ON m.id = u.membro_id
        WHERE u.login = ? AND u.ativo = 1`,
      dto.login.trim().toLowerCase(),
    );
    if (!u || !bcrypt.compareSync(dto.senha, u.senha_hash)) {
      throw new UnauthorizedException('Login ou senha inválidos.');
    }
    const payload: UsuarioLogado = {
      id: u.id,
      login: u.login,
      perfil: u.perfil,
      membroId: u.membro_id,
      nome: u.membro_nome ?? u.login,
    };
    res.cookie(COOKIE_TOKEN, this.jwt.sign(payload), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60 * 1000,
    });
    return payload;
  }

  @Publico()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_TOKEN);
    return { ok: true };
  }

  @Get('eu')
  eu(@Usuario() u: UsuarioLogado) {
    return u;
  }
}

import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export interface UsuarioLogado {
  id: number;
  login: string;
  perfil: 'ADMIN' | 'MESA';
  membroId: number | null;
  nome: string;
}

export const COOKIE_TOKEN = 'mk_token';

export const PUBLICO = 'publico';
/** Rota sem login (ex.: votação, que usa só o CPF). */
export const Publico = () => SetMetadata(PUBLICO, true);

export const SO_ADMIN = 'so_admin';
export const SoAdmin = () => SetMetadata(SO_ADMIN, true);

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioLogado => {
  return ctx.switchToHttp().getRequest().usuario;
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const alvo = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvo)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[COOKIE_TOKEN];
    if (!token) throw new UnauthorizedException('Faça login para continuar.');
    try {
      req.usuario = this.jwt.verify<UsuarioLogado>(token);
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    if (this.reflector.getAllAndOverride<boolean>(SO_ADMIN, alvo) && req.usuario.perfil !== 'ADMIN') {
      throw new ForbiddenException('Apenas administradores podem fazer isso.');
    }
    return true;
  }
}

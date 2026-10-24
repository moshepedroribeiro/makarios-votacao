import 'dotenv/config';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { garantirAdmin } from './seed';

async function bootstrap() {
  // Sem logger de requisições: o corpo dos votos nunca vai para o log.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (erros) =>
        new BadRequestException(erros.flatMap((e) => Object.values(e.constraints ?? {}))),
    }),
  );
  garantirAdmin(app);
  const porta = Number(process.env.PORT ?? 8080);
  await app.listen(porta);
  console.log(`API do Makários em http://localhost:${porta}/api`);
}
bootstrap();

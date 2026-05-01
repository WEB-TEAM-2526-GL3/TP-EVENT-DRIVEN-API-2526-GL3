import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { RoleEnum } from './enums/role.enum';

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const cookiePairs = cookieHeader.split(';');
  for (const pair of cookiePairs) {
    const [name, ...rawValueParts] = pair.trim().split('=');
    if (name === 'tp_token') {
      const rawValue = rawValueParts.join('=');
      return decodeURIComponent(rawValue);
    }
  }

  return null;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/client' });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const docsAuthMiddleware = (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    const token = extractBearerToken(request);
    const secret = process.env.JWT_SECRET?.toString();

    if (!token || !secret) {
      response.status(401).json({
        message:
          'Unauthorized. Use a valid JWT in Authorization header or tp_token cookie.',
      });
      return;
    }

    try {
      const decoded = verify(token, secret) as { role?: string };
      if (decoded?.role !== RoleEnum.ADMIN) {
        response.status(403).json({
          message: 'Forbidden. Admin access is required for Swagger docs.',
        });
        return;
      }
      next();
    } catch {
      response.status(401).json({ message: 'Unauthorized. Invalid token.' });
    }
  };
  app.use('/docs', docsAuthMiddleware);
  app.use('/docs-json', docsAuthMiddleware);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gestionnaire CV API')
    .setDescription('REST API for CV management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

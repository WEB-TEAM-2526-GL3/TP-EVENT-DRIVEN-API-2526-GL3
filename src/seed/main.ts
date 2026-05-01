import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const seedService = app.get(SeedService);

  console.log('Remplissge de la base de donnees en cours...');
  await seedService.seedDatabase();
  console.log('Base de donnees remplie');

  // Fermeture du script
  await app.close();
}
bootstrap();

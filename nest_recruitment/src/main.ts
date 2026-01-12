import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các field không khai báo trong DTO (Bảo mật)
      forbidNonWhitelisted: true, // (Tuỳ chọn) Báo lỗi ngay nếu gửi field thừa
      transform: true, // Tự động convert data sang đúng kiểu của DTO
    }),
  );
  await app.listen(configService.get<string>('PORT') ?? 8000);
}
bootstrap();

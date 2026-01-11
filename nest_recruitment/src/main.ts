import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các field không khai báo trong DTO (Bảo mật)
      forbidNonWhitelisted: true, // (Tuỳ chọn) Báo lỗi ngay nếu gửi field thừa
      transform: true, // Tự động convert data sang đúng kiểu của DTO
    }),
  );
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();

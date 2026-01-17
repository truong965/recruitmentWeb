import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { JobsModule } from './jobs/jobs.module';
import { FilesModule } from './files/files.module';
import mongooseDelete from 'mongoose-delete';
import mongoosePaginate from 'mongoose-paginate-v2';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ResumesModule } from './resumes/resumes.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { DatabasesModule } from './databases/databases.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './casl/guards/permissions.guard';
import { CaslModule } from './casl/casl.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { MailModule } from './mail/mail.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 10,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
        connectionFactory: (connection) => {
          connection.plugin(mongooseDelete, {
            overrideMethods: 'all', // Tự động override các hàm find, count... để ẩn record đã xóa
            deletedAt: true, // Tự động thêm trường deletedAt
            deletedBy: true, // Thêm trường deletedBy
            deletedByType: Object,
          });

          connection.plugin(mongoosePaginate);
          return connection;
        },
      }),
    }),
    // public file
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // Trỏ đến thư mục public ở root dự án
      exclude: ['/api/(.*)'], // Quan trọng: Đảm bảo nó không chặn các route API của bạn
    }),
    UsersModule,
    AuthModule,
    CompaniesModule,
    JobsModule,
    FilesModule,
    ResumesModule,
    PermissionsModule,
    RolesModule,
    DatabasesModule,
    CaslModule,
    SubscribersModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
// eslint-disable-next-line prettier/prettier
export class AppModule { }
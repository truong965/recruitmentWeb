import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { Job, JobSchema } from './schemas/job.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from 'src/casl/casl.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    CaslModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

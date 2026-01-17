import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  Subscriber,
  SubscriberDocument,
} from 'src/subscribers/schemas/subscriber.schema';
import type { SoftDeleteModel } from 'mongoose-delete';
import { InjectModel } from '@nestjs/mongoose';
import { Job, JobDocument } from 'src/jobs/schemas/job.schema';
@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @InjectModel(Subscriber.name)
    private subscriberModel: SoftDeleteModel<SubscriberDocument>,
    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,
  ) {}

  handleTestEmail = async () => {
    const subscribers = await this.subscriberModel.find({});
    for (const subs of subscribers) {
      const subsSkills = subs.skills;
      const jobWithMatchingSkills = await this.jobModel.find({
        skills: { $in: subsSkills },
      });
      if (jobWithMatchingSkills) {
        const jobs = jobWithMatchingSkills.map((item) => {
          return {
            name: item.name,
            company: item.company.name,
            salary:
              `${item.salary}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' đ',
            skills: item.skills,
          };
        });
        await this.mailerService.sendMail({
          to: 'maiductrung965@gmail.com',
          from: '"Support Team" <support@example.com>', // override default from
          subject: 'Welcome to Nice App! Confirm your Email',
          template: 'new-job',
          context: {
            receiver: subs.name,
            jobs: jobs,
          },
        });
      }
    }
  };
}

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { QUEUE_NAMES, EmailJobName } from '../constants/jobs.constants';
import { QueueService } from '../services/queue.service';
import { EmailService } from '../../email/services/email.service';
import { SendEmailOptions } from '../../email/interfaces/email-provider.interface';

@Processor(QUEUE_NAMES.EMAIL)
@Injectable()
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `Processing email job [${job.name}] (ID: ${job.id}, Attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 5})`,
    );

    switch (job.name) {
      case EmailJobName.SEND_WELCOME_EMAIL: {
        const payload = job.data;
        const html = this.emailService.renderTemplate('welcome', {
          fullName: payload.fullName || 'User',
          loginUrl: payload.loginUrl || 'https://app.jobtracker.io/login',
        });
        return this.emailService.sendDirect(
          {
            to: payload.email,
            subject: 'Welcome to Job Tracker!',
            html,
            attachments: payload.attachments,
          },
          'welcome',
        );
      }

      case EmailJobName.SEND_PASSWORD_RESET: {
        const payload = job.data;
        const html = this.emailService.renderTemplate('password-reset', {
          fullName: payload.fullName || 'User',
          resetLink:
            payload.resetLink || 'https://app.jobtracker.io/reset-password',
        });
        return this.emailService.sendDirect(
          {
            to: payload.email,
            subject: 'Reset Your Job Tracker Password',
            html,
            attachments: payload.attachments,
          },
          'password-reset',
        );
      }

      case EmailJobName.SEND_APPLICATION_UPDATE: {
        const payload = job.data;
        const html = this.emailService.renderTemplate('application-status', {
          fullName: payload.fullName || 'User',
          companyName: payload.companyName || 'Company',
          positionTitle: payload.positionTitle || 'Position',
          oldStatus: payload.oldStatus || 'APPLIED',
          newStatus: payload.newStatus || 'INTERVIEW',
        });
        return this.emailService.sendDirect(
          {
            to: payload.email,
            subject: `Application Update: ${payload.companyName || 'Job Application'}`,
            html,
            attachments: payload.attachments,
          },
          'application-status',
        );
      }

      case 'SEND_TEMPLATE_EMAIL': {
        const payload = job.data;
        const html =
          payload.html ||
          this.emailService.renderTemplate(
            payload.templateName,
            payload.context || {},
          );
        return this.emailService.sendDirect(
          {
            to: payload.to,
            subject: payload.subject,
            html,
            attachments: payload.attachments,
          },
          payload.templateName || 'template',
        );
      }

      case 'SEND_GENERIC_EMAIL': {
        const payload = job.data as SendEmailOptions;
        return this.emailService.sendDirect(payload, 'generic');
      }

      default:
        this.logger.warn(
          `Unknown email job name [${job.name}], processing as generic email`,
        );
        return this.emailService.sendDirect(
          job.data as SendEmailOptions,
          job.name,
        );
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts || 5;
    this.logger.error(
      `Job [${job.name}] (ID: ${job.id}) in queue [${QUEUE_NAMES.EMAIL}] failed on attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
    );

    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Job [${job.name}] (ID: ${job.id}) exhausted all ${maxAttempts} retry attempts. Moving to Dead Letter Queue.`,
      );
      await this.queueService.moveToDeadLetterQueue({
        originalQueue: QUEUE_NAMES.EMAIL,
        jobName: job.name,
        jobId: job.id,
        data: job.data,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

import {
  Injectable,
  Logger,
  Inject,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import {
  EMAIL_PROVIDER_TOKEN,
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
  EmailAttachment,
} from '../interfaces/email-provider.interface';
import { QueueService } from '../../jobs/services/queue.service';
import { QUEUE_NAMES } from '../../jobs/constants/jobs.constants';
import { MetricsService } from '../../../core/metrics/metrics.service';

export interface SendTemplateOptions {
  to: string | string[];
  subject: string;
  templateName: string;
  context: Record<string, any>;
  attachments?: EmailAttachment[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly templateCache = new Map<
    string,
    handlebars.TemplateDelegate
  >();
  private readonly templatesDir: string;

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly emailProvider: any,
    private readonly queueService: QueueService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    this.templatesDir = path.join(__dirname, '..', 'templates');
  }

  renderTemplate(templateName: string, context: Record<string, any>): string {
    const cleanName = templateName.replace(/\.hbs$/, '');

    let template = this.templateCache.get(cleanName);
    if (!template) {
      const templatePath = path.join(this.templatesDir, `${cleanName}.hbs`);
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(
          `Email template '${cleanName}' does not exist at ${templatePath}`,
        );
      }
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      template = handlebars.compile(templateContent);
      this.templateCache.set(cleanName, template);
    }

    const mergedContext = {
      currentYear: new Date().getFullYear(),
      ...context,
    };

    return template(mergedContext);
  }

  async send(options: SendEmailOptions) {
    this.logger.log(
      `Enqueuing raw email job for ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
    );
    return this.queueService.enqueue(
      QUEUE_NAMES.EMAIL,
      'SEND_GENERIC_EMAIL',
      options,
    );
  }

  async sendTemplate(options: SendTemplateOptions) {
    const html = this.renderTemplate(options.templateName, options.context);
    const emailPayload: SendEmailOptions & { templateName?: string } = {
      to: options.to,
      subject: options.subject,
      html,
      attachments: options.attachments,
      templateName: options.templateName,
    };

    this.logger.log(
      `Enqueuing template email job [${options.templateName}] for ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
    );
    return this.queueService.enqueue(
      QUEUE_NAMES.EMAIL,
      'SEND_TEMPLATE_EMAIL',
      emailPayload,
    );
  }

  async sendBulk(
    recipients: string[],
    subject: string,
    templateName: string,
    contextBuilder: (recipient: string) => Record<string, any>,
  ) {
    this.logger.log(
      `Enqueuing bulk email jobs for ${recipients.length} recipients using template [${templateName}]`,
    );
    const jobs: any[] = [];
    for (const recipient of recipients) {
      const context = contextBuilder(recipient);
      const job = await this.sendTemplate({
        to: recipient,
        subject,
        templateName,
        context,
      });
      jobs.push(job);
    }
    return jobs;
  }

  async sendDirect(
    options: SendEmailOptions,
    templateName = 'custom',
  ): Promise<SendEmailResult> {
    const startTime = Date.now();
    const recipient = Array.isArray(options.to)
      ? options.to.join(', ')
      : options.to;

    try {
      const result: SendEmailResult =
        await this.emailProvider.sendEmail(options);
      const durationMs = Date.now() - startTime;

      this.logger.log(
        `[Email Log] Status: SUCCESS | Recipient: ${recipient} | Template: ${templateName} | Duration: ${durationMs}ms | MessageId: ${result.messageId}`,
      );

      if (this.metricsService) {
        this.metricsService.emailsSentTotal.inc({ template: templateName });
        this.metricsService.emailDurationSeconds.observe(
          { template: templateName },
          durationMs / 1000,
        );
      }

      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      this.logger.error(
        `[Email Log] Status: FAILED | Recipient: ${recipient} | Template: ${templateName} | Duration: ${durationMs}ms | Error: ${error.message}`,
      );

      if (this.metricsService) {
        this.metricsService.emailsFailedTotal.inc({ template: templateName });
        this.metricsService.emailDurationSeconds.observe(
          { template: templateName },
          durationMs / 1000,
        );
      }

      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    return this.emailProvider.verifyConnection();
  }
}

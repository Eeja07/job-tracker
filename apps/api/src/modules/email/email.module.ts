import { Module, Global } from '@nestjs/common';
import { EMAIL_PROVIDER_TOKEN } from './interfaces/email-provider.interface';
import { SMTPProvider } from './providers/smtp.provider';
import { EmailService } from './services/email.service';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useClass: SMTPProvider,
    },
    EmailService,
  ],
  exports: [EMAIL_PROVIDER_TOKEN, EmailService],
})
export class EmailModule {}

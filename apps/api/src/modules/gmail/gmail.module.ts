import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';

@Module({
  imports: [PrismaModule, WebsocketModule, WhatsappModule, TelegramModule],
  providers: [GmailService],
  controllers: [GmailController],
  exports: [GmailService],
})
export class GmailModule {}

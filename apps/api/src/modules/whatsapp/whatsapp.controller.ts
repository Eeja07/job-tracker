import { Controller, Post, Body, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';

@ApiTags('WhatsApp')
@Controller({ path: 'whatsapp', version: '1' })
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: { from: string; body: string; pushName?: string },
    @Headers('x-api-key') apiKey?: string,
  ) {
    this.whatsappService.handleIncomingWebhook(payload).catch((err) => {
      console.error('Webhook error:', err);
    });

    return { status: 'received' };
  }

  @Post('test-send')
  @HttpCode(HttpStatus.OK)
  async testSend(@Body() body: { to: string; message: string }) {
    const success = await this.whatsappService.sendTextMessage(body.to, body.message);
    return { success };
  }
}

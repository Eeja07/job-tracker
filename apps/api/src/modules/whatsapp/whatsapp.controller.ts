import { Controller, Get, Post, Body, HttpCode, HttpStatus, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsappService } from './whatsapp.service';

@ApiTags('WhatsApp')
@Controller({ path: 'whatsapp', version: '1' })
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getStatus() {
    return this.whatsappService.getStatus();
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async logout() {
    const success = await this.whatsappService.logoutSession();
    return { success };
  }

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async testSend(@Body() body: { to: string; message: string }) {
    const success = await this.whatsappService.sendTextMessage(body.to, body.message);
    return { success };
  }
}

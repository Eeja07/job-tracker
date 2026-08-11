import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram')
@Controller({ path: 'telegram', version: '1' })
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getStatus() {
    return this.telegramService.getStatus();
  }

  @Post('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async updateConfig(@Body() body: { botToken: string; chatId: string }) {
    this.telegramService.setConfig(body.botToken, body.chatId);
    return { success: true, status: this.telegramService.getStatus() };
  }

  @Post('test-send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async testSend(@Body() body: { chatId?: string; message?: string }) {
    const success = await this.telegramService.sendTelegramMessage(
      body.chatId || '',
      body.message || '🤖 <b>Halo!</b> Ini pesan uji coba notifikasi Telegram Bot dari Job Tracker 👋',
      'HTML',
    );
    return { success };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: any) {
    this.telegramService.handleUpdate(update).catch((err) => {
      console.error('Telegram webhook error:', err);
    });
    return { status: 'received' };
  }
}

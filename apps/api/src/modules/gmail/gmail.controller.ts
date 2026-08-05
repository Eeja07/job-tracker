import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Redirect,
  UseGuards,
  Request as NestRequest,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.controller';
import { GmailService } from './gmail.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Gmail')
@ApiBearerAuth()
@Controller({ path: 'gmail', version: '1' })
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly config: ConfigService,
  ) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Gmail OAuth URL to connect account' })
  async getConnectUrl(@NestRequest() req: any) {
    const userId = (req as AuthenticatedRequest).user.sub;
    const url = this.gmailService.getAuthUrl(userId);
    return { url };
  }

  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback — handle Gmail authorization code' })
  @Redirect()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
  ) {
    try {
      await this.gmailService.handleCallback(code, userId);
      const webUrl = this.config.get<string>(
        'FRONTEND_URL',
        'https://job.eeja.fun',
      );
      return { url: `${webUrl}/dashboard/gmail?status=connected` };
    } catch (err: any) {
      const webUrl = this.config.get<string>(
        'FRONTEND_URL',
        'https://job.eeja.fun',
      );
      return {
        url: `${webUrl}/dashboard/gmail?status=error&msg=${encodeURIComponent(err.message)}`,
      };
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Check Gmail connection status and unread notification count',
  })
  async getStatus(@NestRequest() req: any) {
    const userId = (req as AuthenticatedRequest).user.sub;
    return this.gmailService.getConnectionStatus(userId);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Gmail account' })
  async disconnect(@NestRequest() req: any) {
    const userId = (req as AuthenticatedRequest).user.sub;
    await this.gmailService.disconnectGmail(userId);
    return { message: 'Gmail disconnected' };
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger Gmail sync (fetch new emails)' })
  async sync(@NestRequest() req: any) {
    const userId = (req as AuthenticatedRequest).user.sub;
    const result = await this.gmailService.syncEmails(userId);
    return { success: true, ...result };
  }

  @Get('emails')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get synced email messages' })
  async getEmails(
    @NestRequest() req: any,
    @Query('jobOnly') jobOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req as AuthenticatedRequest).user.sub;
    return this.gmailService.getEmailMessages(
      userId,
      jobOnly === 'true',
      limit ? Number(limit) : 30,
    );
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get in-app notifications' })
  async getNotifications(
    @NestRequest() req: any,
    @Query('limit') limit?: string,
  ) {
    const userId = (req as AuthenticatedRequest).user.sub;
    return this.gmailService.getNotifications(
      userId,
      limit ? Number(limit) : 50,
    );
  }

  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@NestRequest() req: any, @Param('id') id: string) {
    const userId = (req as AuthenticatedRequest).user.sub;
    await this.gmailService.markNotificationRead(id, userId);
    return { success: true };
  }

  @Patch('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@NestRequest() req: any) {
    const userId = (req as AuthenticatedRequest).user.sub;
    await this.gmailService.markAllNotificationsRead(userId);
    return { success: true };
  }
}

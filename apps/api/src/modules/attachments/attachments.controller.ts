import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request as NestRequest,
  Response as NestResponse,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  FileValidator,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.controller';
import { AttachmentService } from './attachment.service';
import { AttachmentResponseDto } from './dto/attachment.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { LocalStorageProvider } from '../storage/providers/local-storage.provider';
import { StorageService } from '../storage/storage.service';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export class CustomMimeTypeValidator extends FileValidator<{ allowedMimes: string[] }> {
  isValid(file?: Express.Multer.File): boolean {
    if (!file || !file.mimetype) return false;
    return this.validationOptions.allowedMimes.includes(file.mimetype);
  }

  buildErrorMessage(file: Express.Multer.File): string {
    return `Invalid file type '${file?.mimetype}'. Allowed types: ${this.validationOptions.allowedMimes.join(', ')}`;
  }
}

@ApiTags('Attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentService: AttachmentService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file attachment (PDF, DOCX, PNG, JPG, WEBP, max 10MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'applicationId', 'type', 'label'],
      properties: {
        file: { type: 'string', format: 'binary' },
        applicationId: { type: 'string', format: 'uuid' },
        type: { type: 'string', enum: ['RESUME', 'CV', 'COVER_LETTER', 'PORTFOLIO', 'CERTIFICATE', 'OTHER'] },
        label: { type: 'string' },
        version: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Attachment uploaded successfully', type: AttachmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error (oversized file or invalid MIME type)' })
  @ApiResponse({ status: 422, description: 'Security error (malware detected during virus scan)' })
  async upload(
    @NestRequest() req: any,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES, message: 'File size exceeds maximum limit of 10 MB' })
        .addValidator(new CustomMimeTypeValidator({ allowedMimes: ALLOWED_MIME_TYPES }))
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
  ): Promise<AttachmentResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.attachmentService.upload(authReq.user.sub, dto, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List attachments for a job application' })
  @ApiResponse({ status: 200, description: 'List of attachments', type: [AttachmentResponseDto] })
  async findByApplication(
    @NestRequest() req: any,
    @Query('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<AttachmentResponseDto[]> {
    const authReq = req as AuthenticatedRequest;
    return this.attachmentService.findByApplication(applicationId, authReq.user.sub);
  }

  @Get('signed-access')
  @ApiOperation({ summary: 'Access attachment via signed URL token' })
  @ApiResponse({ status: 200, description: 'Binary file payload' })
  @ApiResponse({ status: 401, description: 'Expired or invalid signed URL token' })
  async accessSigned(
    @Query('key') key: string,
    @Query('mode') mode: 'GET' | 'PUT',
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Headers('range') range: string | undefined,
    @NestResponse() res: Response,
  ): Promise<void> {
    const localProvider = new LocalStorageProvider();
    const isValid = localProvider.verifySignedToken(key, mode, expires, signature);

    if (!isValid) {
      throw new UnauthorizedException('Expired or invalid signed URL token');
    }

    const { start, end } = this.parseRangeHeader(range);
    const streamResult = await this.storageService.getReadStream(key, start, end);

    if (typeof start === 'number' && typeof end === 'number') {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${streamResult.totalLength}`);
      res.setHeader('Content-Length', streamResult.contentLength);
    } else {
      res.status(HttpStatus.OK);
      res.setHeader('Content-Length', streamResult.totalLength);
    }

    res.setHeader('Content-Type', streamResult.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(key.split('/').pop() || 'file')}"`);
    streamResult.stream.pipe(res);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get attachment metadata details by ID' })
  @ApiResponse({ status: 200, description: 'Attachment metadata', type: AttachmentResponseDto })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async findOne(
    @NestRequest() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttachmentResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.attachmentService.findOne(id, authReq.user.sub);
  }

  @Get(':id/signed-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate 15-minute signed URL for secure download' })
  @ApiResponse({ status: 200, description: 'Signed URL string' })
  async getSignedUrl(
    @NestRequest() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('mode') mode?: 'GET' | 'PUT',
  ): Promise<{ signedUrl: string; expiresInSeconds: number }> {
    const authReq = req as AuthenticatedRequest;
    const urlMode = mode === 'PUT' ? 'PUT' : 'GET';
    const signedUrl = await this.attachmentService.getSignedUrl(id, authReq.user.sub, urlMode, 900);
    return { signedUrl, expiresInSeconds: 900 };
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download attachment file (supports HTTP byte-range streaming)' })
  @ApiResponse({ status: 200, description: 'Binary file payload (full)' })
  @ApiResponse({ status: 206, description: 'Partial Content (byte-range stream)' })
  @ApiResponse({ status: 404, description: 'Attachment or file not found' })
  async download(
    @NestRequest() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @NestResponse() res: Response,
  ): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    const { start, end } = this.parseRangeHeader(range);

    const { streamResult, attachment } = await this.attachmentService.getReadStream(
      id,
      authReq.user.sub,
      start,
      end,
    );

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.filename || 'attachment')}"`,
    );
    res.setHeader('ETag', `"${attachment.checksum || attachment.id}"`);

    if (typeof start === 'number' && typeof end === 'number') {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${streamResult.totalLength}`);
      res.setHeader('Content-Length', streamResult.contentLength);
    } else {
      res.status(HttpStatus.OK);
      res.setHeader('Content-Length', streamResult.totalLength);
    }

    streamResult.stream.pipe(res);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete attachment metadata and physical file' })
  @ApiResponse({ status: 204, description: 'Attachment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async remove(
    @NestRequest() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    await this.attachmentService.remove(id, authReq.user.sub);
  }

  private parseRangeHeader(rangeHeader?: string): { start?: number; end?: number } {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return {};
    }

    const parts = rangeHeader.replace('bytes=', '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : undefined;

    if (isNaN(start)) return {};
    return { start, end };
  }
}

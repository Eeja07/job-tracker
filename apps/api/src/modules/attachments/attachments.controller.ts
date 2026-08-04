import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request as NestRequest,
  Response as NestResponse,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  FileValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.controller';
import { AttachmentService } from './attachment.service';
import { AttachmentResponseDto } from './dto/attachment.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

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
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload')
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
  @ApiOperation({ summary: 'List attachments for a job application' })
  @ApiResponse({ status: 200, description: 'List of attachments', type: [AttachmentResponseDto] })
  async findByApplication(
    @NestRequest() req: any,
    @Query('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<AttachmentResponseDto[]> {
    const authReq = req as AuthenticatedRequest;
    return this.attachmentService.findByApplication(applicationId, authReq.user.sub);
  }

  @Get(':id')
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

  @Get(':id/download')
  @ApiOperation({ summary: 'Download physical attachment file' })
  @ApiResponse({ status: 200, description: 'Binary file payload' })
  @ApiResponse({ status: 404, description: 'Attachment or file not found' })
  async download(
    @NestRequest() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @NestResponse() res: Response,
  ): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    const { buffer, attachment } = await this.attachmentService.download(id, authReq.user.sub);

    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.filename || 'attachment')}"`,
    );
    res.send(buffer);
  }

  @Delete(':id')
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
}

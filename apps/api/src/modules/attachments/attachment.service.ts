import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Attachment } from '@prisma/client';
import { AttachmentRepository } from '../../repositories/attachment/attachment.repository';
import { ApplicationRepository } from '../../repositories/application/application.repository';
import { StorageService } from '../storage/storage.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@Injectable()
export class AttachmentService {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly storageService: StorageService,
  ) {}

  async upload(
    userId: string,
    dto: UploadAttachmentDto,
    file: Express.Multer.File,
  ): Promise<Attachment> {
    if (!file) {
      throw new BadRequestException('File is required for upload');
    }

    // Verify application existence and user ownership
    const application = await this.applicationRepository.findById(dto.applicationId);
    if (!application || application.userId !== userId) {
      throw new NotFoundException(`Application with ID '${dto.applicationId}' was not found`);
    }

    // Upload physical file via StorageService
    const uploadResult = await this.storageService.uploadFile(file);

    // Persist attachment metadata record
    return this.attachmentRepository.create({
      applicationId: dto.applicationId,
      userId,
      type: dto.type,
      label: dto.label,
      filename: uploadResult.filename,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      storageProvider: uploadResult.storageProvider,
      storagePath: uploadResult.storagePath,
      checksum: uploadResult.checksum,
      version: dto.version,
    });
  }

  async findByApplication(applicationId: string, userId: string): Promise<Attachment[]> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application || application.userId !== userId) {
      throw new NotFoundException(`Application with ID '${applicationId}' was not found`);
    }

    return this.attachmentRepository.findByApplication(applicationId);
  }

  async findOne(id: string, userId: string): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findById(id);
    if (!attachment || attachment.userId !== userId) {
      throw new NotFoundException(`Attachment with ID '${id}' was not found`);
    }

    return attachment;
  }

  async download(
    id: string,
    userId: string,
  ): Promise<{ buffer: Buffer; attachment: Attachment }> {
    const attachment = await this.findOne(id, userId);
    const buffer = await this.storageService.downloadFile(attachment.storagePath);
    return { buffer, attachment };
  }

  async remove(id: string, userId: string): Promise<void> {
    const attachment = await this.findOne(id, userId);

    // Delete physical storage file first
    await this.storageService.deleteFile(attachment.storagePath);

    // Delete database record
    await this.attachmentRepository.delete(id);
  }
}

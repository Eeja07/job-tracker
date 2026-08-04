import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty({ description: 'Target job application ID', example: 'app-uuid-1' })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({ description: 'Note markdown content', example: 'Prepared interview questions regarding microservice scalability.' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ description: 'Whether the note is pinned to top', default: false, example: true })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean = false;
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}

export class NoteResponseDto {
  @ApiProperty({ example: 'note-uuid-1' })
  id!: string;

  @ApiProperty({ example: 'app-uuid-1' })
  applicationId!: string;

  @ApiProperty({ example: 'user-uuid-1' })
  userId!: string;

  @ApiProperty({ example: 'Prepared interview questions regarding microservice scalability.' })
  content!: string;

  @ApiProperty({ example: true })
  pinned!: boolean;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  updatedAt!: Date;
}

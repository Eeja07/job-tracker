import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateNoteDto, UpdateNoteDto, NoteResponseDto } from './dto/note.dto';

@ApiTags('Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  @Post()
  @ApiOperation({ summary: 'Create note for application' })
  @ApiResponse({ status: 201, description: 'Note created', type: NoteResponseDto })
  async create(@Body() _dto: CreateNoteDto): Promise<NoteResponseDto> {
    throw new Error('Contract placeholder - not implemented');
  }

  @Get()
  @ApiOperation({ summary: 'Get notes for an application' })
  @ApiResponse({ status: 200, description: 'Notes list', type: [NoteResponseDto] })
  async findByApplication(
    @Query('applicationId') _applicationId: string,
  ): Promise<NoteResponseDto[]> {
    throw new Error('Contract placeholder - not implemented');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get note details by ID' })
  @ApiResponse({ status: 200, description: 'Note details', type: NoteResponseDto })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async findOne(@Param('id') _id: string): Promise<NoteResponseDto> {
    throw new Error('Contract placeholder - not implemented');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update note content or pinned state' })
  @ApiResponse({ status: 200, description: 'Note updated', type: NoteResponseDto })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async update(
    @Param('id') _id: string,
    @Body() _dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    throw new Error('Contract placeholder - not implemented');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete note' })
  @ApiResponse({ status: 204, description: 'Note deleted' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async remove(@Param('id') _id: string): Promise<void> {
    throw new Error('Contract placeholder - not implemented');
  }
}

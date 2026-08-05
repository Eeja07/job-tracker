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
  Request as NestRequest,
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
import { NoteService } from './note.service';
import { CreateNoteDto, UpdateNoteDto, NoteResponseDto } from './dto/note.dto';

@ApiTags('Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly noteService: NoteService) {}

  @Post()
  @ApiOperation({ summary: 'Create note for application' })
  @ApiResponse({
    status: 201,
    description: 'Note created',
    type: NoteResponseDto,
  })
  async create(
    @NestRequest() req: any,
    @Body() dto: CreateNoteDto,
  ): Promise<NoteResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.noteService.create(authReq.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get notes for an application' })
  @ApiResponse({
    status: 200,
    description: 'Notes list',
    type: [NoteResponseDto],
  })
  async findByApplication(
    @NestRequest() req: any,
    @Query('applicationId') applicationId: string,
  ): Promise<NoteResponseDto[]> {
    const authReq = req as AuthenticatedRequest;
    return this.noteService.findByApplication(applicationId, authReq.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get note details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Note details',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async findOne(
    @NestRequest() req: any,
    @Param('id') id: string,
  ): Promise<NoteResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.noteService.findOne(id, authReq.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update note content or pinned state' })
  @ApiResponse({
    status: 200,
    description: 'Note updated',
    type: NoteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async update(
    @NestRequest() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.noteService.update(id, authReq.user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete note' })
  @ApiResponse({ status: 204, description: 'Note deleted' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async remove(
    @NestRequest() req: any,
    @Param('id') id: string,
  ): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    await this.noteService.remove(id, authReq.user.sub);
  }
}

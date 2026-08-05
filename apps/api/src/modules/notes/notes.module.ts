import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NoteService } from './note.service';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [NotesController],
  providers: [NoteService],
  exports: [NoteService],
})
export class NotesModule {}

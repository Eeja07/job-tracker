import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * BaseRepository acts as an infrastructure helper for resolves database context (PrismaService vs. Prisma.TransactionClient).
 * It intentionally contains no generic CRUD logic, preventing ORM leakage and enforce domain encapsulation.
 */
export abstract class BaseRepository<TDelegate> {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Returns the model delegate instance tied to either an active transaction or the global PrismaService.
   */
  protected abstract getDelegate(tx?: Prisma.TransactionClient): TDelegate;
}

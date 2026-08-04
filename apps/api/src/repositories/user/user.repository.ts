import { Injectable } from '@nestjs/common';
import { User, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  avatarUrl?: string;
  isEmailVerified?: boolean;
}

export interface UpdateUserData {
  email?: string;
  passwordHash?: string;
  fullName?: string;
  avatarUrl?: string;
  isEmailVerified?: boolean;
  lastLoginAt?: Date;
}

@Injectable()
export class UserRepository extends BaseRepository<Prisma.UserDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(tx?: Prisma.TransactionClient): Prisma.UserDelegate {
    return tx ? tx.user : this.prisma.user;
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<User | null> {
    return this.getDelegate(tx).findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string, tx?: Prisma.TransactionClient): Promise<User | null> {
    return this.getDelegate(tx).findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserData, tx?: Prisma.TransactionClient): Promise<User> {
    return this.getDelegate(tx).create({
      data,
    });
  }

  async update(id: string, data: UpdateUserData, tx?: Prisma.TransactionClient): Promise<User> {
    return this.getDelegate(tx).update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<User> {
    return this.getDelegate(tx).delete({
      where: { id },
    });
  }
}

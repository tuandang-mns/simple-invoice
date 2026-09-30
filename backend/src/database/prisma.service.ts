import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Called on SIGTERM thanks to enableShutdownHooks() — closes pool cleanly. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

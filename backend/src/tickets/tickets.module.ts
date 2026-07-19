import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { SseService } from './sse.service';

@Module({
  controllers: [TicketsController],
  providers: [SseService],
  exports: [SseService],
})
export class TicketsModule {}
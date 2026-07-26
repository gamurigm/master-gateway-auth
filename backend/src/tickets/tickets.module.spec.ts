import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsModule } from './tickets.module';
import { SseService } from './sse.service';

describe('TicketsModule', () => {
  it('registers the tickets controller and SSE service', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TicketsModule],
    }).compile();

    expect(module.get(TicketsController)).toBeInstanceOf(TicketsController);
    expect(module.get(SseService)).toBeInstanceOf(SseService);
  });
});

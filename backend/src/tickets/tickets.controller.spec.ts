import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { TicketsController } from './tickets.controller';
import { SseEvent, SseService } from './sse.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  const sseService = {
    emitEvent: jest.fn(),
    getEventStream: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: SseService,
          useValue: sseService,
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('maps ticket events to server-sent messages', async () => {
    const event: SseEvent = {
      type: 'ticket.created',
      data: { id: 'ticket-1' },
    };
    sseService.getEventStream.mockReturnValue(of(event));

    await expect(firstValueFrom(controller.events())).resolves.toEqual({
      type: event.type,
      data: JSON.stringify(event.data),
    });
  });

  it('emits ticket events through the SSE service', () => {
    const payload = { id: 'ticket-1', status: 'OPEN' };

    expect(
      controller.emitEvent({ type: 'ticket.updated', data: payload }),
    ).toEqual({
      message: 'Evento de ticket emitido correctamente',
      type: 'ticket.updated',
    });
    expect(sseService.emitEvent).toHaveBeenCalledWith(
      'ticket.updated',
      payload,
    );
  });
});

import { firstValueFrom } from 'rxjs';
import { SseService } from './sse.service';

describe('SseService', () => {
  let service: SseService;

  beforeEach(() => {
    service = new SseService();
  });

  it('publishes events to subscribers', async () => {
    const eventPromise = firstValueFrom(service.getEventStream());
    const data = { id: 'ticket-1' };

    service.emitEvent('ticket.created', data);

    await expect(eventPromise).resolves.toEqual({
      type: 'ticket.created',
      data,
    });
  });
});

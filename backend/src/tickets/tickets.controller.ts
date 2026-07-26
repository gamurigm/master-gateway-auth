import { Body, Controller, MessageEvent, Post, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { SseEvent, SseService } from './sse.service';

interface EmitTicketEventDto {
  type: string;
  data: unknown;
}

@Controller('tickets')
export class TicketsController {
  constructor(private readonly sseService: SseService) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.sseService.getEventStream().pipe(
      map((event: SseEvent) => ({
        type: event.type,
        data: JSON.stringify(event.data),
      })),
    );
  }

  @Post('events')
  emitEvent(@Body() event: EmitTicketEventDto) {
    this.sseService.emitEvent(event.type, event.data);
    return {
      message: 'Evento de ticket emitido correctamente',
      type: event.type,
    };
  }
}

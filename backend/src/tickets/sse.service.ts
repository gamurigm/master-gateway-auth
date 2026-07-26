import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface SseEvent {
  type: string;
  data: unknown;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private readonly eventSubject = new Subject<SseEvent>();

  emitEvent(type: string, data: unknown): void {
    this.logger.log(`Emitiendo evento SSE: ${type}`);
    this.eventSubject.next({ type, data });
  }

  getEventStream(): Observable<SseEvent> {
    return this.eventSubject.asObservable();
  }
}

import type { CompletionEvent, Event } from '@domain/appointments/index';

export interface Publisher {
  publish(event: Event): Promise<void>;
}

export interface ConfirmationPublisher {
  publish(event: CompletionEvent): Promise<void>;
}

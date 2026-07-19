import { HttpInterceptorFn } from "@angular/common/http";
import { ApplicationRef, NgZone, inject } from "@angular/core";
import { Observable } from "rxjs";

export const zoneInterceptor: HttpInterceptorFn = (request, next) => {
  const zone = inject(NgZone);
  const appRef = inject(ApplicationRef);

  return new Observable((subscriber) => {
    let tickScheduled = false;
    const scheduleTick = () => {
      if (tickScheduled) {
        return;
      }

      tickScheduled = true;
      queueMicrotask(() => {
        tickScheduled = false;
        zone.run(() => appRef.tick());
      });
    };

    const runInZone = (callback: () => void) => {
      zone.run(() => {
        try {
          callback();
        } finally {
          scheduleTick();
        }
      });
    };

    const subscription = next(request).subscribe({
      next: (event) => runInZone(() => subscriber.next(event)),
      error: (error: unknown) => runInZone(() => subscriber.error(error)),
      complete: () => runInZone(() => subscriber.complete()),
    });

    return () => subscription.unsubscribe();
  });
};

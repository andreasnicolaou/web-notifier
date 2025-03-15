import { from, Observable, of, throwError } from 'rxjs';
import { catchError, delay, switchMap } from 'rxjs/operators';

export interface WebPushNotifierOptions extends NotificationOptions {
  autoDismiss?: number; // Time in milliseconds to auto-dismiss the notification
  delay?: number; // Time in milliseconds to delay the notification
}

interface WebPushNotifierCallbacks {
  onclick?: (notification: Notification) => void;
  onclose?: (notification: Notification) => void;
  onPermissionDenied?: () => void;
}

export class WebPushNotifier {
  private activeNotifications: Notification[] = [];
  private readonly globalCallbacks: WebPushNotifierCallbacks;
  private readonly globalOptions: WebPushNotifierOptions;
  private readonly messageError = 'This browser does not support notifications.';

  /**
   * Constructs a new WebPushNotifier instance with optional global settings.
   * @param globalOptions Default notification options that apply to all notifications.
   * @param globalCallbacks Default callbacks that apply to all notifications.
   */
  constructor(
    globalOptions: WebPushNotifierOptions = Object.create(Object.prototype),
    globalCallbacks: WebPushNotifierCallbacks = Object.create(Object.prototype)
  ) {
    this.globalOptions = globalOptions;
    this.globalCallbacks = globalCallbacks;

    if (!('Notification' in window)) {
      console.warn(this.messageError);
    }
  }

  /**
   * Dismisses all active notifications by closing them.
   * @memberof WebPushNotifier
   */
  public dismissAll(): void {
    this.activeNotifications.forEach((notification) => notification.close());
    this.activeNotifications = [];
  }

  /**
   * Shows a notification with the given title, options, and callbacks.
   * Returns an Observable that emits the notification instance if successful.
   * @param title
   * @param [options]
   * @param [callbacks]
   * @returns show
   * @memberof WebPushNotifier
   */
  public show(
    title: string,
    options: WebPushNotifierOptions = Object.create(Object.prototype),
    callbacks: WebPushNotifierCallbacks = Object.create(Object.prototype)
  ): Observable<Notification | null> {
    if (!('Notification' in window)) {
      console.warn(this.messageError);
      return throwError(() => new Error(this.messageError));
    }

    const notification$ = this.handleNotification(
      title,
      { ...this.globalOptions, ...options },
      { ...this.globalCallbacks, ...callbacks }
    );
    notification$.subscribe();
    return notification$;
  }

  /**
   * Creates and displays a notification with the provided options and attaches event handlers.
   * @param title - The title of the notification
   * @param options - The options of the notification
   * @param callbacks - The callbacks of the notification
   * @returns notification
   * @memberof WebPushNotifier
   */
  private createNotification(
    title: string,
    options: WebPushNotifierOptions,
    callbacks: WebPushNotifierCallbacks
  ): Notification | null {
    try {
      const notification = new Notification(title, options);
      this.activeNotifications.push(notification);

      if (callbacks.onclick) {
        notification.onclick = (): void => {
          callbacks.onclick?.(notification);
          if (typeof window.focus === 'function') {
            window.focus();
          }
        };
      }

      if (callbacks.onclose) {
        notification.onclose = (): void => {
          callbacks.onclose?.(notification);
          this.activeNotifications = this.activeNotifications.filter((n) => n !== notification);
        };
      }

      if (options.autoDismiss && options.autoDismiss > 0) {
        setTimeout(() => {
          notification.close();
          this.activeNotifications = this.activeNotifications.filter((n) => n !== notification);
        }, options.autoDismiss);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  /**
   * Handles notification permissions and displays the notification if allowed.
   * @param title - The title of the notification
   * @param options - The options of the notification
   * @param callbacks - The callbacks of the notification
   * @returns notification
   * @memberof WebPushNotifier
   */
  private handleNotification(
    title: string,
    options: WebPushNotifierOptions,
    callbacks: WebPushNotifierCallbacks
  ): Observable<Notification | null> {
    if (typeof Notification === 'undefined') {
      console.warn(this.messageError);
      return of(null);
    }
    return of(Notification.permission).pipe(
      switchMap((permission: NotificationPermission) => {
        if (permission === 'granted') {
          return of(this.createNotification(title, options, callbacks)).pipe(delay(options.delay ?? 0));
        }
        if (permission !== 'denied') {
          return from(Notification.requestPermission()).pipe(
            switchMap((newPermission) => {
              if (newPermission === 'granted') {
                return of(this.createNotification(title, options, callbacks)).pipe(delay(options.delay ?? 0));
              }
              callbacks.onPermissionDenied?.();
              return of(null);
            })
          );
        }
        callbacks.onPermissionDenied?.();
        return of(null);
      }),
      catchError((error) => {
        console.error('Error handling notification:', error);
        return throwError(() => error);
      })
    );
  }
}

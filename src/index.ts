import { firstValueFrom, from, Observable, of, ReplaySubject, Subscription, throwError, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

interface PendingNotification {
  subject: ReplaySubject<Notification | null>;
  subscription?: Subscription;
}

export interface WebPushNotifierOptions extends NotificationOptions {
  /** Time in milliseconds after which the notification is automatically closed. */
  autoDismiss?: number;
  /** Time in milliseconds to wait before the notification is shown. */
  delay?: number;
}

export interface WebPushNotifierCallbacks {
  /** Invoked when the user clicks the notification. */
  onclick?: (notification: Notification) => void;
  /** Invoked when the notification is closed (by the user, autoDismiss or dismissAll). */
  onclose?: (notification: Notification) => void;
  /** Invoked when the notification fails to display. */
  onerror?: (error: unknown) => void;
  /** Invoked when the notification is shown. */
  onshow?: (notification: Notification) => void;
  /** Invoked when permission is (or has already been) denied. */
  onPermissionDenied?: () => void;
}

export class WebPushNotifier {
  private activeNotifications: Notification[] = [];
  private readonly dismissTimers = new Map<Notification, ReturnType<typeof setTimeout>>();
  private readonly globalCallbacks: WebPushNotifierCallbacks;
  private readonly globalOptions: WebPushNotifierOptions;
  private readonly messageError = 'This browser does not support notifications.';
  private readonly pending = new Set<PendingNotification>();

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

    if (!WebPushNotifier.isSupported()) {
      console.warn(this.messageError);
    }
  }

  /**
   * Indicates whether the current environment supports the Notification API.
   * @returns boolean
   * @memberof WebPushNotifier
   */
  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && typeof window.Notification !== 'undefined';
  }

  /**
   * The number of notifications currently being tracked as active.
   * @memberof WebPushNotifier
   */
  public get activeCount(): number {
    return this.activeNotifications.length;
  }

  /**
   * The current notification permission, or `'unsupported'` when the API is unavailable.
   * @memberof WebPushNotifier
   */
  public get permission(): NotificationPermission | 'unsupported' {
    return WebPushNotifier.isSupported() ? Notification.permission : 'unsupported';
  }

  /**
   * Dismisses all active notifications by closing them.
   * @memberof WebPushNotifier
   */
  public dismissAll(): void {
    // Cancel notifications that are still pending (e.g. waiting on a `delay`) before they appear,
    // and resolve any awaiting subscribers with `null` instead of leaving them hanging.
    this.pending.forEach((entry) => {
      entry.subscription?.unsubscribe();
      entry.subject.next(null);
      entry.subject.complete();
    });
    this.pending.clear();
    this.dismissTimers.forEach((timer) => clearTimeout(timer));
    this.dismissTimers.clear();
    this.activeNotifications.forEach((notification) => notification.close());
    this.activeNotifications = [];
  }

  /**
   * Indicates whether the current environment supports the Notification API.
   * @returns boolean
   * @memberof WebPushNotifier
   */
  public isSupported(): boolean {
    return WebPushNotifier.isSupported();
  }

  /**
   * Requests notification permission from the user. If permission has already been
   * granted or denied, the existing value is returned without prompting again.
   * @returns An Observable emitting the resulting permission.
   * @memberof WebPushNotifier
   */
  public requestPermission(): Observable<NotificationPermission> {
    if (!WebPushNotifier.isSupported()) {
      console.warn(this.messageError);
      return throwError(() => new Error(this.messageError));
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return of(Notification.permission);
    }
    return from(this.requestBrowserPermission()).pipe(
      catchError((error) => {
        console.error('Error requesting notification permission:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Shows a notification with the given title, options, and callbacks.
   * Returns a shared Observable that emits the notification instance if successful, or `null`
   * when permission is not granted. The notification is created exactly once regardless of
   * how many times the returned Observable is subscribed to, and a notification that is still
   * pending (e.g. waiting on a `delay`) is cancelled by {@link dismissAll}.
   * @param title - The title of the notification
   * @param [options] - The options of the notification
   * @param [callbacks] - The callbacks of the notification
   * @returns Observable<Notification | null>
   * @memberof WebPushNotifier
   */
  public show(
    title: string,
    options: WebPushNotifierOptions = Object.create(Object.prototype),
    callbacks: WebPushNotifierCallbacks = Object.create(Object.prototype)
  ): Observable<Notification | null> {
    if (!WebPushNotifier.isSupported()) {
      console.warn(this.messageError);
      return throwError(() => new Error(this.messageError));
    }

    // A ReplaySubject lets the notification be created exactly once (eagerly, so fire-and-forget
    // works) while replaying the result to any number of later subscribers. The driving
    // subscription is tracked so it can be cancelled by `dismissAll` while still pending.
    const entry: PendingNotification = { subject: new ReplaySubject<Notification | null>(1) };
    this.pending.add(entry);

    entry.subscription = this.handleNotification(
      title,
      { ...this.globalOptions, ...options },
      { ...this.globalCallbacks, ...callbacks }
    ).subscribe({
      next: (notification) => entry.subject.next(notification),
      error: (error) => {
        this.pending.delete(entry);
        entry.subject.error(error);
      },
      complete: () => {
        this.pending.delete(entry);
        entry.subject.complete();
      },
    });

    return entry.subject.asObservable();
  }

  /**
   * Promise-based variant of {@link show}. Resolves with the notification instance if
   * successful, or `null` when permission is not granted.
   * @param title - The title of the notification
   * @param [options] - The options of the notification
   * @param [callbacks] - The callbacks of the notification
   * @returns Promise<Notification | null>
   * @memberof WebPushNotifier
   */
  public showAsync(
    title: string,
    options: WebPushNotifierOptions = Object.create(Object.prototype),
    callbacks: WebPushNotifierCallbacks = Object.create(Object.prototype)
  ): Promise<Notification | null> {
    return firstValueFrom(this.show(title, options, callbacks));
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

      notification.onclick = (): void => {
        callbacks.onclick?.(notification);
        if (typeof window !== 'undefined' && typeof window.focus === 'function') {
          window.focus();
        }
      };

      notification.onclose = (): void => {
        callbacks.onclose?.(notification);
        this.removeActive(notification);
      };

      if (callbacks.onshow) {
        notification.onshow = (): void => callbacks.onshow?.(notification);
      }

      if (callbacks.onerror) {
        notification.onerror = (): void => callbacks.onerror?.(new Error('Notification failed to display.'));
      }

      if (options.autoDismiss && options.autoDismiss > 0) {
        const timer = setTimeout(() => {
          notification.close();
          this.removeActive(notification);
        }, options.autoDismiss);
        this.dismissTimers.set(notification, timer);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      callbacks.onerror?.(error);
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
    if (!WebPushNotifier.isSupported()) {
      console.warn(this.messageError);
      return of(null);
    }
    const create = (): Observable<Notification | null> => {
      const wait = options.delay && options.delay > 0 ? options.delay : 0;
      return (wait > 0 ? timer(wait) : of(0)).pipe(map(() => this.createNotification(title, options, callbacks)));
    };
    return of(Notification.permission).pipe(
      switchMap((permission: NotificationPermission) => {
        if (permission === 'granted') {
          return create();
        }
        if (permission !== 'denied') {
          return from(this.requestBrowserPermission()).pipe(
            switchMap((newPermission) => {
              if (newPermission === 'granted') {
                return create();
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

  /**
   * Removes a notification from the active list.
   * @param notification - The notification to remove
   * @memberof WebPushNotifier
   */
  private removeActive(notification: Notification): void {
    const timer = this.dismissTimers.get(notification);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.dismissTimers.delete(notification);
    }
    this.activeNotifications = this.activeNotifications.filter((n) => n !== notification);
  }

  /**
   * Requests browser permission, normalising the modern Promise-based API and the legacy
   * callback-only form (e.g. older Safari, where `requestPermission()` returns `undefined`).
   * @returns Promise<NotificationPermission>
   * @memberof WebPushNotifier
   */
  private requestBrowserPermission(): Promise<NotificationPermission> {
    return new Promise<NotificationPermission>((resolve, reject) => {
      try {
        const result = Notification.requestPermission((permission) => resolve(permission));
        if (result && typeof result.then === 'function') {
          result.then(resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

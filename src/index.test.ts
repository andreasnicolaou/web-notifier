/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebPushNotifier, WebPushNotifierOptions } from './index';
declare let global: any;

const setupNotificationMock = (instances: any[]): void => {
  global.Notification = jest.fn().mockImplementation(function Notification(
    this: any,
    title: string,
    options?: WebPushNotifierOptions
  ) {
    this.title = title;
    this.options = options || {};
    this.permission = 'granted';
    this.onclick = jest.fn();
    this.onclose = jest.fn();
    this.onshow = jest.fn();
    this.onerror = jest.fn();
    this.close = jest.fn();
    instances.push(this);
  });
  global.Notification.permission = 'granted';
  global.Notification.requestPermission = jest.fn(() => Promise.resolve('granted'));
  global.Notification.prototype = {
    ...global.Notification.prototype,
    close: jest.fn(),
    onclick: jest.fn(),
    onclose: jest.fn(),
  };
};

describe('WebPushNotifier', () => {
  let mockNotificationInstances: any[] = [];

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window, 'focus', {
      value: jest.fn(),
      writable: true,
    });
  });

  afterAll(() => {
    delete global.Notification;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationInstances = [];
    setupNotificationMock(mockNotificationInstances);
  });

  it('should initialize with global options and callbacks', () => {
    const notifier = new WebPushNotifier({ autoDismiss: 5000, icon: 'icon.png' }, { onPermissionDenied: jest.fn() });
    expect(notifier).toBeInstanceOf(WebPushNotifier);
  });

  it('should show a notification if permission is granted', () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    const showSpy = jest.spyOn<WebPushNotifier, any>(notifier, 'createNotification');
    notifier.show('Test Title', { body: 'Test Body' }).subscribe();
    expect(showSpy).toHaveBeenCalledWith('Test Title', { body: 'Test Body' }, {});
  });

  it('should create exactly one notification even when the returned observable is subscribed', () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }).subscribe();
    expect(mockNotificationInstances).toHaveLength(1);
  });

  it('should request permission and show a notification if permission is not denied', (done) => {
    global.Notification.permission = 'default';
    const notifier = new WebPushNotifier();
    const showSpy = jest.spyOn<WebPushNotifier, any>(notifier, 'createNotification');
    notifier.show('Test Title', { body: 'Test Body' }).subscribe(() => {
      expect(global.Notification.requestPermission).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalledWith('Test Title', { body: 'Test Body' }, {});
      done();
    });
  });

  it('should call onPermissionDenied if permission is denied', (done) => {
    global.Notification.permission = 'denied';
    const onPermissionDenied = jest.fn();
    const notifier = new WebPushNotifier({}, { onPermissionDenied });
    notifier.show('Test Title', { body: 'Test Body' }).subscribe(() => {
      expect(onPermissionDenied).toHaveBeenCalled();
      done();
    });
  });

  it('should call onclick callback when notification is clicked', () => {
    global.Notification.permission = 'granted';
    const onclick = jest.fn();
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }, { onclick }).subscribe();
    expect(mockNotificationInstances[0]).toBeDefined();
    mockNotificationInstances[0].onclick();
    expect(onclick).toHaveBeenCalledWith(mockNotificationInstances[0]);
  });

  it('should call onclose callback when notification is closed', () => {
    global.Notification.permission = 'granted';
    const onclose = jest.fn();
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }, { onclose }).subscribe();
    expect(mockNotificationInstances[0]).toBeDefined();
    mockNotificationInstances[0].onclose();
    expect(onclose).toHaveBeenCalledWith(mockNotificationInstances[0]);
  });

  it('should call onshow callback when the notification is shown', () => {
    global.Notification.permission = 'granted';
    const onshow = jest.fn();
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }, { onshow }).subscribe();
    mockNotificationInstances[0].onshow();
    expect(onshow).toHaveBeenCalledWith(mockNotificationInstances[0]);
  });

  it('should auto-dismiss the notification if autoDismiss is enabled', () => {
    jest.useFakeTimers();
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier({ autoDismiss: 5000 });
    notifier.show('Test Title', { body: 'Test Body' }).subscribe();
    const mockNotificationInstance = mockNotificationInstances[0];
    expect(mockNotificationInstance.close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(mockNotificationInstance.close).toHaveBeenCalled();
    expect(notifier.activeCount).toBe(0);
    jest.useRealTimers();
  });

  it('should delay creating the notification when the delay option is set', () => {
    jest.useFakeTimers();
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body', delay: 1000 }).subscribe();
    expect(mockNotificationInstances).toHaveLength(0);
    jest.advanceTimersByTime(1000);
    expect(mockNotificationInstances).toHaveLength(1);
    jest.useRealTimers();
  });

  it('should cancel pending delayed notifications when dismissAll is called', () => {
    jest.useFakeTimers();
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body', delay: 1000 }).subscribe();
    expect(mockNotificationInstances).toHaveLength(0);
    notifier.dismissAll();
    jest.advanceTimersByTime(1000);
    expect(mockNotificationInstances).toHaveLength(0);
    jest.useRealTimers();
  });

  it('should resolve null from showAsync when a pending delayed notification is dismissed', async () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    const promise = notifier.showAsync('Test Title', { body: 'Test Body', delay: 1000 });
    notifier.dismissAll();
    await expect(promise).resolves.toBeNull();
    expect(mockNotificationInstances).toHaveLength(0);
  });

  it('should dismiss all active notifications', () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    notifier.show('Test Title 1', { body: 'Test Body 1' }).subscribe();
    notifier.show('Test Title 2', { body: 'Test Body 2' }).subscribe();
    expect(notifier.activeCount).toBe(2);
    notifier.dismissAll();
    mockNotificationInstances.forEach((instance: any) => {
      expect(instance.close).toHaveBeenCalled();
    });
    expect(notifier.activeCount).toBe(0);
  });

  it('should remove a notification from the active list when it is closed', () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }).subscribe();
    expect(notifier.activeCount).toBe(1);
    mockNotificationInstances[0].onclose();
    expect(notifier.activeCount).toBe(0);
  });

  it('should resolve the notification instance via showAsync', async () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    const notification = await notifier.showAsync('Test Title', { body: 'Test Body' });
    expect(notification).not.toBeNull();
    expect(mockNotificationInstances).toHaveLength(1);
  });

  it('should resolve null via showAsync when permission is denied', async () => {
    global.Notification.permission = 'denied';
    const onPermissionDenied = jest.fn();
    const notifier = new WebPushNotifier({}, { onPermissionDenied });
    const notification = await notifier.showAsync('Test Title');
    expect(notification).toBeNull();
    expect(onPermissionDenied).toHaveBeenCalled();
  });

  it('should report support and the current permission', () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    expect(WebPushNotifier.isSupported()).toBe(true);
    expect(notifier.isSupported()).toBe(true);
    expect(notifier.permission).toBe('granted');
  });

  it('should return the existing permission from requestPermission without prompting', (done) => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    notifier.requestPermission().subscribe((permission) => {
      expect(permission).toBe('granted');
      expect(global.Notification.requestPermission).not.toHaveBeenCalled();
      done();
    });
  });

  it('should prompt for permission from requestPermission when undecided', (done) => {
    global.Notification.permission = 'default';
    const notifier = new WebPushNotifier();
    notifier.requestPermission().subscribe((permission) => {
      expect(global.Notification.requestPermission).toHaveBeenCalled();
      expect(permission).toBe('granted');
      done();
    });
  });

  it('should call onPermissionDenied when the prompt is dismissed', (done) => {
    global.Notification.permission = 'default';
    global.Notification.requestPermission = jest.fn(() => Promise.resolve('denied'));
    const onPermissionDenied = jest.fn();
    const notifier = new WebPushNotifier({}, { onPermissionDenied });
    notifier.show('Test Title').subscribe((notification) => {
      expect(notification).toBeNull();
      expect(onPermissionDenied).toHaveBeenCalled();
      done();
    });
  });

  it('should invoke onerror and return null when creating the notification throws', () => {
    global.Notification.permission = 'granted';
    global.Notification = jest.fn(() => {
      throw new Error('boom');
    }) as any;
    global.Notification.permission = 'granted';
    const onerror = jest.fn();
    const notifier = new WebPushNotifier();
    let emitted: Notification | null = 'unset' as unknown as Notification;
    notifier.show('Test Title', {}, { onerror }).subscribe((value) => (emitted = value));
    expect(onerror).toHaveBeenCalled();
    expect(emitted).toBeNull();
  });

  it('should forward native error events to the onerror callback', () => {
    global.Notification.permission = 'granted';
    const onerror = jest.fn();
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }, { onerror }).subscribe();
    mockNotificationInstances[0].onerror();
    expect(onerror).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should error from requestPermission when notifications are unsupported', (done) => {
    global.Notification = undefined;
    const notifier = new WebPushNotifier();
    notifier.requestPermission().subscribe({
      error: (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      },
    });
  });

  it('should warn and error when the browser does not support notifications', (done) => {
    global.Notification = undefined;
    const consoleWarnSpy = jest.spyOn(console, 'warn');
    const notifier = new WebPushNotifier();
    expect(notifier.permission).toBe('unsupported');
    notifier.show('Test Title', { body: 'Test Body' }).subscribe({
      error: (error) => {
        expect(error).toBeInstanceOf(Error);
        expect(consoleWarnSpy).toHaveBeenCalledWith('This browser does not support notifications.');
        done();
      },
    });
  });
});

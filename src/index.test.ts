/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebPushNotifier, WebPushNotifierOptions } from './index';
declare let global: any;
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
      this.close = jest.fn();
      mockNotificationInstances.push(this);
    });

    global.Notification.permission = 'granted';
    global.Notification.requestPermission = jest.fn(() => Promise.resolve('granted'));

    global.Notification.prototype = {
      ...global.Notification.prototype,
      close: jest.fn(),
      onclick: jest.fn(),
      onclose: jest.fn(),
    };
  });

  afterAll(() => {
    delete global.Notification;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationInstances = [];
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
    if (mockNotificationInstances[0]) {
      mockNotificationInstances[0].onclick();
      expect(onclick).toHaveBeenCalledWith(mockNotificationInstances[0]);
    }
  });

  it('should call onclose callback when notification is closed', () => {
    global.Notification.permission = 'granted';
    const onclose = jest.fn();
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }, { onclose }).subscribe();
    if (mockNotificationInstances[0]) {
      mockNotificationInstances[0].onclose();
      expect(onclose).toHaveBeenCalledWith(mockNotificationInstances[0]);
    }
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
    jest.useRealTimers();
  });

  it('should dismiss all active notifications', () => {
    global.Notification.permission = 'granted';
    const notifier = new WebPushNotifier();
    notifier.show('Test Title 1', { body: 'Test Body 1' }).subscribe();
    notifier.show('Test Title 2', { body: 'Test Body 2' }).subscribe();
    notifier.dismissAll();
    mockNotificationInstances.forEach((instance: any) => {
      expect(instance.close).toHaveBeenCalled();
    });
  });

  it('should log a warning if the browser does not support notifications', () => {
    global.Notification = undefined;
    const consoleWarnSpy = jest.spyOn(console, 'warn');
    const notifier = new WebPushNotifier();
    notifier.show('Test Title', { body: 'Test Body' }).subscribe();
    expect(consoleWarnSpy).toHaveBeenCalledWith('This browser does not support notifications.');
  });
});

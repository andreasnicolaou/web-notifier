<p align="center">
  <img src="logo.png" alt="Logo">
</p>

# WebPushNotifier

A lightweight and flexible web notification library that provides a simple API for handling notifications using RxJS observables. It allows you to request permission, display notifications, and handle user interactions in a reactive way.

## Features

- Show web notifications with customizable options.
- Auto-dismiss notifications after a set of time (optional).
- Delay notifications after a set of time (optional).
- Handle click, close and permission denied events with callbacks.
- Gracefully manage notification permissions.

## Installation

```sh
npm install @andreasnicolaou/web-notifier
```

## Usage

```typescript
import { WebPushNotifier } from '@andreasnicolaou/web-notifier';

const webPushNotifier = new WebPushNotifier({ autoDismiss: 5000 });
webPushNotifier.show('Hello there!', { body: 'This is a test notification using @andreasnicolaou/web-notifier.' });
```

## API

```sh
new WebPushNotifier(globalOptions?: WebPushNotifierOptions, globalCallbacks?: WebPushNotifierCallbacks)
```

Creates a new notification handler with optional default settings.

- **globalOptions**: Default notification options.
- **globalCallbacks**: Default callbacks for notification events.

```sh
.show(title: string, options?: WebPushNotifierOptions, callbacks?: WebPushNotifierCallbacks): Observable<Notification | null>
```

Creates & Displays the notification.

- **title**: The title of the notification.
- **options**: Notification options (optional).
- **callbacks**: Callbacks for notification events (optional).
- Returns an Observable that emits the notification instance if successful.

```sh
.dismissAll(): void
```

Closes all active notifications.

## Learn more about the Notification API

- [Notification API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification)
- [Browser Compatibility - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification#browser_compatibility)

<p align="center">
  <img src="logo.png" alt="Logo">
</p>

# @andreasnicolaou/web-notifier

A lightweight, dependency-friendly wrapper around the browser [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notification). It gives you a clean, reactive (RxJS) **and** Promise-based API for requesting permission, showing notifications, auto-dismissing them, delaying them, and reacting to click/close/show events.

[![GitHub License](https://img.shields.io/github/license/andreasnicolaou/web-notifier)](https://github.com/andreasnicolaou/web-notifier/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@andreasnicolaou/web-notifier.svg)](https://www.npmjs.com/package/@andreasnicolaou/web-notifier)
[![npm downloads](https://img.shields.io/npm/dm/@andreasnicolaou/web-notifier.svg)](https://www.npmjs.com/package/@andreasnicolaou/web-notifier)
[![Types](https://img.shields.io/npm/types/@andreasnicolaou/web-notifier.svg)](https://www.npmjs.com/package/@andreasnicolaou/web-notifier)
[![Minified size](https://img.shields.io/bundlephobia/min/@andreasnicolaou/web-notifier)](https://bundlephobia.com/package/@andreasnicolaou/web-notifier)

👉 **[Try the live demo](https://andreasnicolaou.github.io/web-notifier/)** — request permission and fire real notifications right from your browser.

> **Note:** This library wraps the **Notification API** (the small banner/toast notifications a page can show while it is open). It does **not** implement the [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) or service-worker push, so it does not deliver messages while the site is closed. If you only need to notify the user while your app is running, this is for you.

## Features

- 🔔 Show browser notifications with the full set of native options.
- ⏱️ Auto-dismiss notifications after a configurable timeout.
- ⏳ Delay a notification before it is shown.
- 🖱️ Handle `click`, `close`, `show`, `error` and permission-denied events via callbacks.
- 🛡️ Graceful permission handling — never prompts twice, never throws on unsupported browsers.
- 🧩 Use it your way: **RxJS Observables** (`show`) or **Promises** (`showAsync`).
- 🪶 Tiny, tree-shakeable ESM/CJS builds plus a ready-to-use UMD bundle for CDNs.
- 📘 Written in TypeScript with complete type definitions.

## Installation

```sh
npm install @andreasnicolaou/web-notifier
```

> `rxjs` (v7+) is a dependency. If your app already uses RxJS, it is deduped automatically.

## Usage

### Promise API (simplest)

```typescript
import { WebPushNotifier } from '@andreasnicolaou/web-notifier';

const notifier = new WebPushNotifier({ autoDismiss: 5000 });

const notification = await notifier.showAsync('Hello there!', {
  body: 'This is a test notification using @andreasnicolaou/web-notifier.',
});

if (notification) {
  console.log('Notification shown!');
}
```

### RxJS API

```typescript
import { WebPushNotifier } from '@andreasnicolaou/web-notifier';

const notifier = new WebPushNotifier({ autoDismiss: 5000 });

notifier
  .show('Hello there!', { body: 'Reactive notification.' }, { onclick: () => console.log('clicked') })
  .subscribe((notification) => {
    if (notification) {
      console.log('Notification shown!');
    }
  });
```

You can also fire-and-forget — calling `show()` displays the notification immediately, even without subscribing:

```typescript
notifier.show('Quick ping!');
```

### Checking support and permission

```typescript
if (WebPushNotifier.isSupported()) {
  const notifier = new WebPushNotifier();
  notifier.requestPermission().subscribe((permission) => {
    console.log('Permission is now:', permission); // 'granted' | 'denied' | 'default'
  });
}
```

## CDN Usage

You can use the library directly in the browser via CDN. The UMD build exposes the global variable `webNotifier`.

```html
<script src="https://unpkg.com/@andreasnicolaou/web-notifier"></script>
<script>
  const Notifier = window.webNotifier.WebPushNotifier;
  const notifier = new Notifier({ autoDismiss: 2000 });
  notifier.show('Hello from CDN!', { body: 'This is a test notification.' });
</script>
```

Other CDN entry points:

- **unpkg (minified):** `https://unpkg.com/@andreasnicolaou/web-notifier/dist/index.umd.min.js`
- **jsDelivr (unminified):** `https://cdn.jsdelivr.net/npm/@andreasnicolaou/web-notifier/dist/index.umd.js`
- **jsDelivr (minified):** `https://cdn.jsdelivr.net/npm/@andreasnicolaou/web-notifier/dist/index.umd.min.js`

## API

### `new WebPushNotifier(globalOptions?, globalCallbacks?)`

Creates a notifier. `globalOptions` and `globalCallbacks` are merged into (and overridden by) the per-call options/callbacks passed to `show` / `showAsync`.

### `show(title, options?, callbacks?): Observable<Notification | null>`

Shows a notification. Returns a **shared** Observable that emits the `Notification` instance (or `null` if permission was not granted). The notification is created **exactly once**, no matter how many times you subscribe.

### `showAsync(title, options?, callbacks?): Promise<Notification | null>`

Promise-based variant of `show`. Resolves with the `Notification` instance, or `null` when permission is not granted. Rejects if notifications are unsupported.

### `requestPermission(): Observable<NotificationPermission>`

Requests permission, returning the existing value without re-prompting if it has already been granted or denied.

### `dismissAll(): void`

Closes all notifications created by this instance that are still open.

### `isSupported(): boolean` / `WebPushNotifier.isSupported(): boolean`

Returns whether the current environment supports the Notification API (available as both an instance and a static method).

### `permission: NotificationPermission | 'unsupported'` _(getter)_

The current permission, or `'unsupported'` when the API is unavailable.

### `activeCount: number` _(getter)_

The number of notifications from this instance that are currently open.

### Options (`WebPushNotifierOptions`)

Extends the native [`NotificationOptions`](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification#options) with:

| Option        | Type     | Description                                                        |
| ------------- | -------- | ------------------------------------------------------------------ |
| `autoDismiss` | `number` | Milliseconds after which the notification is automatically closed. |
| `delay`       | `number` | Milliseconds to wait before the notification is shown.             |

### Callbacks (`WebPushNotifierCallbacks`)

| Callback             | Signature                              | When it fires                               |
| -------------------- | -------------------------------------- | ------------------------------------------- |
| `onclick`            | `(notification: Notification) => void` | The user clicks the notification.           |
| `onclose`            | `(notification: Notification) => void` | The notification is closed.                 |
| `onshow`             | `(notification: Notification) => void` | The notification is shown.                  |
| `onerror`            | `(error: unknown) => void`             | The notification fails to display.          |
| `onPermissionDenied` | `() => void`                           | Permission is (or has already been) denied. |

## Notes & limitations

These come from the underlying Notification API, not from this library:

- **The OS controls display.** Your operating system decides how many notifications are visible at
  once and may queue or coalesce them — that is expected, not a bug.
- **`activeCount` / `dismissAll` are best-effort.** They track notifications this instance created
  and was told were closed. Some browsers (notably Chrome on Windows) fire the `close` event
  unreliably, so a notification the user closes from the OS may remain counted until you call
  `dismissAll()`. For deterministic cleanup, use the `autoDismiss` option — the library closes those
  itself and updates its tracking regardless of the `close` event.
- **Permission must be requested from a user gesture** (e.g. a click handler) in modern browsers.

## Learn more about the Notification API

- [Notification API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification)
- [Browser Compatibility - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification#browser_compatibility)

## License

[MIT](./LICENSE) © Andreas Nicolaou

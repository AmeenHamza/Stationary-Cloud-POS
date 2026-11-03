import type { Page } from '@playwright/test';

/** Resolves once the page's socket has sent its `shopEvents` subscribe (after connection_ack). */
export function liveChannel(page: Page): Promise<void> {
  return new Promise((resolve) => {
    page.on('websocket', (socket) => {
      socket.on('framesent', (frame) => {
        if (String(frame.payload).includes('"type":"subscribe"')) resolve();
      });
    });
  });
}

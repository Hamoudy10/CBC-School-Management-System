/**
 * Offline service worker registration utility
 * Handles registration, updates, and communication with the service worker
 */
import { useEffect } from 'react';
import { logger } from '../../../lib/logger';

/**
 * Register the service worker for offline capabilities
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerOfflineSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service workers are not supported in this browser', {
      source: 'offline.sw.registration'
    });
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    logger.info('Service worker registered successfully', {
      source: 'offline.sw.registration',
      scope: registration.scope
    });

    // Listen for state changes
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              logger.info('New or updated content is available', {
                source: 'offline.sw.registration'
              });
            } else {
              logger.info('Content is now available offline!', {
                source: 'offline.sw.registration'
              });
            }
          }
        });
      }
    });

    return registration;
  } catch (error) {
    logger.error('Failed to register service worker', {
      source: 'offline.sw.registration',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return null;
  }
}

/**
 * Unregister the service worker
 * @returns {Promise<void>}
 */
export async function unregisterOfflineSW(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    logger.info('Service worker unregistered successfully', {
      source: 'offline.sw.registration'
    });
  } catch (error) {
    logger.error('Failed to unregister service worker', {
      source: 'offline.sw.registration',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
  }
}

/**
 * Check if the service worker is active and controlling the page
 * @returns {Promise<boolean>}
 */
export async function isOfflineSWActive(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const controller = navigator.serviceWorker.controller;
    return controller !== null;
  } catch (error) {
    logger.error('Failed to check service worker controller status', {
      source: 'offline.sw.registration',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return false;
  }
}

/**
 * Send a message to the service worker
 * @param {Object} message - Message to send
 * @returns {Promise<any>} Response from service worker
 */
export async function messageOfflineSW(message: any): Promise<any> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('No active service worker to message');
  }

  const controller = navigator.serviceWorker.controller;
  if (!controller) {
    throw new Error('No active service worker to message');
  }

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = event => {
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
    };

    controller.postMessage(message, [messageChannel.port2]);
  });
}

export default {
  registerOfflineSW,
  unregisterOfflineSW,
  isOfflineSWActive,
  messageOfflineSW
};

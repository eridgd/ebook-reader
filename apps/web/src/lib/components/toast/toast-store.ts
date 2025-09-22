/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import { writable } from 'svelte/store';

export type ToastItem = {
  id: number;
  message: string;
  type?: 'success' | 'info' | 'error';
};

export const toasts$ = writable<ToastItem[]>([]);

export function showToast(message: string, durationMs = 1500, type: ToastItem['type'] = 'success') {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  toasts$.update((items) => [...items, { id, message, type }]);
  setTimeout(() => {
    toasts$.update((items) => items.filter((t) => t.id !== id));
  }, durationMs);
}

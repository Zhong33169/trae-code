import type { User } from '$lib/types';

declare global {
  namespace App {
    interface Locals {
      accessToken: string | null;
      user?: User | null;
    }
    interface PageData {
      user?: User | null;
    }
    interface Error {
      message: string;
      code?: number;
    }
  }
}

export {};

/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../../src/types';

// This is a dummy interface to be used during development when not in a Worker context
export interface D1ClientWrapper {
  // Basic query methods
  prepare: (query: string) => {
    bind: (...params: any[]) => {
      first: <T = any>() => Promise<T | null>;
      run: () => Promise<{ success: boolean; meta: { last_row_id?: number } }>;
      all: <T = any>() => Promise<{ results: T[] }>;
    };
  };
  
  // Transaction support (simplified for non-CF environment)
  batch: <T = unknown>(statements: any[]) => Promise<any[]>;
}

// Development fallback when not in a Worker context
class MockD1Client implements D1ClientWrapper {
  constructor() {
    console.warn('Using mock D1 client in development environment');
  }

  prepare(query: string) {
    console.log('D1 query:', query);
    
    return {
      bind: (...params: any[]) => {
        console.log('D1 params:', params);
        
        return {
          first: async <T>() => null as T | null,
          run: async () => ({ success: false, meta: {} }),
          all: async <T>() => ({ results: [] as T[] }),
        };
      },
    };
  }

  async batch<T>(statements: any[]) {
    console.log('D1 batch:', statements);
    return [];
  }
}

// Get the D1 database client, with fallback for development
export function getDb(env?: Env): D1ClientWrapper | D1Database {
  // In a Worker environment, return the actual D1 client
  if (env?.DB) {
    return env.DB;
  }
  
  // In development, return a mock client
  return new MockD1Client();
}

// Export a direct reference for convenience in non-Worker contexts
export const db = new MockD1Client(); 
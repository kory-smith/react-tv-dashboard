/// <reference types="@cloudflare/workers-types" />
import { Router } from 'itty-router';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { apiRouter } from './routes/api';
import type { Env } from './types';

// Create main router
const router = Router();

// API routes
router.all('/api/*', apiRouter.handle);

// Static assets and client-side routing
router.all('*', async (request: Request, env: Env, ctx: ExecutionContext) => {
  try {
    // Try to get a static asset from KV
    return await getAssetFromKV(
      {
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: {},
        cacheControl: {
          browserTTL: 60 * 60 * 24 * 365, // 1 year
          edgeTTL: 60 * 60 * 24 * 30, // 30 days
          bypassCache: false,
        },
      }
    );
  } catch (e) {
    // If the asset is not found or there's another error, serve the index.html
    // for client-side routing
    const indexUrl = new URL(request.url);
    indexUrl.pathname = '/index.html';
    
    try {
      return await getAssetFromKV(
        {
          request: new Request(indexUrl.toString(), request),
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: {},
        }
      );
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  }
});

// Main worker handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return handleCors(request);
      }
      
      // Add CORS headers to all responses
      const response = await router.handle(request, env, ctx);
      return addCorsHeaders(response, request);
    } catch (e) {
      // Handle any errors
      console.error(e);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

// CORS helpers
function handleCors(request: Request): Response {
  const headers = request.headers;
  const origin = headers.get('Origin') || '*';
  
  // Return a preflight response
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function addCorsHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get('Origin') || '*';
  
  // Clone the response and add CORS headers
  const corsResponse = new Response(response.body, response);
  corsResponse.headers.set('Access-Control-Allow-Origin', origin);
  corsResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return corsResponse;
} 
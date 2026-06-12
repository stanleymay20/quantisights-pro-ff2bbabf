/**
 * Cloudflare Pages Worker — Security Headers Middleware
 *
 * Injects enterprise-grade security headers on every response.
 * Deployed automatically when quantivis.io is served via Cloudflare Pages.
 * This is the primary mechanism for headers that cannot be set via meta tags
 * (X-Frame-Options, Permissions-Policy, Cross-Origin-Opener-Policy).
 */

const SECURITY_HEADERS = {
  // Prevent MIME-type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Clickjacking protection (belt-and-suspenders alongside CSP frame-ancestors)
  'X-Frame-Options': 'SAMEORIGIN',

  // Force HTTPS for 1 year
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Referrer privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Restrict browser feature APIs
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'interest-cohort=()',
  ].join(', '),

  // Prevent cross-origin window attacks (popup flows allowed for Google OAuth)
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',

  // Restrict cross-origin resource sharing to same site
  'Cross-Origin-Resource-Policy': 'same-site',

  // Enable DNS prefetch for performance
  'X-DNS-Prefetch-Control': 'on',

  // Remove server fingerprint
  'Server': 'quantivis',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://ai.gateway.lovable.dev https://api.stripe.com https://sheets.googleapis.com https://oauth2.googleapis.com https://login.microsoftonline.com",
  "frame-src https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

export default {
  async fetch(request, env) {
    // Forward request to the Cloudflare Pages asset server
    const response = await env.ASSETS.fetch(request);

    // Clone to make headers mutable
    const newResponse = new Response(response.body, response);

    // Inject all security headers
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      newResponse.headers.set(key, value);
    }
    newResponse.headers.set('Content-Security-Policy', CSP);

    return newResponse;
  },
};

// Security headers, the same for the local server and the hosted site (as TM Bweyogerere).
// Inline style attributes are allowed because the pitch places players with them; scripts are not.
import { readFileSync } from 'node:fs';

export function dbUrl(root) {
  return (readFileSync(new URL('config.js', root), 'utf8').match(/url:\s*'([^']*)'/) || [])[1] || '';
}

export function securityHeaders(db) {
  return {
    'Content-Security-Policy': [
      "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com',
      "img-src 'self' data: blob:", `connect-src 'self'${db ? ' ' + db : ''}`, "manifest-src 'self'", "worker-src 'self'",
      "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

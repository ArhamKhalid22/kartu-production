// This module body is appended to generated asset constants by build-site.mjs.
const csp = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" + (backendOrigin ? ' '+backendOrigin : '') + "; form-action 'self'; upgrade-insecure-requests";
function respond(body, status, type, method, extra = {}) {
  return new Response(method === 'HEAD' ? null : body, {status, headers:{
    'Content-Type':type,
    'Content-Security-Policy':csp,
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security':'max-age=31536000',
    'Cache-Control':'no-store',
    'X-Robots-Tag':'noindex, nofollow',
    ...extra
  }});
}
export default {
  async fetch(request) {
    const method = request.method;
    if (!['GET','HEAD'].includes(method)) return respond('Method not allowed',405,'text/plain',method,{'Allow':'GET, HEAD'});
    const pathname = new URL(request.url).pathname;
    if (pathname === '/healthz') return respond(JSON.stringify({status:'ok',...release,backendConfigured:!!backendOrigin}),200,'application/json',method);
    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!asset) return respond('Not found',404,'text/plain',method);
    return respond(asset.body,200,asset.type,method);
  }
};

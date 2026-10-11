/** Where to look for a dashboard server, in order. */
export type Probe = 'server' | 'static';

/**
 * The local dashboard serves `/api/health`; the static export (GitHub Pages) has `api/health.json` next to the page.
 * Probing the wrong one is a 404 in the console. Loopback, IP-literal and single-label hosts (a LAN or Tailscale name)
 * are a dashboard server; a public domain name is static hosting, so it asks for the static file first and a server
 * behind a custom domain still answers on the second probe.
 */
export function probeOrder(hostname: string): Probe[] {
  const serverHost = !hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':');
  return serverHost ? ['server'] : ['static', 'server'];
}

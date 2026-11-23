import os from 'node:os';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** Private LAN IPv4 addresses so phones/other PCs can use the Network URL in `next dev`. */
function lanHostnames(): string[] {
  const hosts = new Set<string>();
  for (const rows of Object.values(os.networkInterfaces())) {
    for (const row of rows ?? []) {
      if (row.family !== 'IPv4' || row.internal) continue;
      hosts.add(row.address);
    }
  }
  for (const extra of (process.env.ALLOWED_DEV_ORIGINS ?? '').split(',')) {
    const host = extra.trim().replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    if (host) hosts.add(host);
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  transpilePackages: ['@ibas/shared-constants', '@ibas/shared-types', '@zoom/meetingsdk'],
  // Next 16 blocks /_next + client nav from LAN IPs unless listed here.
  allowedDevOrigins: lanHostnames(),
};

export default withNextIntl(nextConfig);

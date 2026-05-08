import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  outputFileTracingRoot: __dirname,
};

export default config;

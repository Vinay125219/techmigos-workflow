import { loadEnvConfig } from '@next/env';

// Ensure standalone tsx scripts get the same env loading behavior as Next.js runtime.
loadEnvConfig(process.cwd());


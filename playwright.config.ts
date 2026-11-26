import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
);
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testDatabaseUrl) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL before running E2E tests.');

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000', headless: true },
  webServer: {
    command: 'npm run dev -- --webpack',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      ...inheritedEnv,
      DATABASE_URL: testDatabaseUrl,
      NEXTAUTH_URL: 'http://localhost:3000',
      NODE_ENV: 'development',
    },
  },
});

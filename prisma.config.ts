import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

export default {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
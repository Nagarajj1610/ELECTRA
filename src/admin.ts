import { getStats } from './logger.ts';

export const getAdminStats = (password: string) => {
  if (password !== process.env.ADMIN_PASSWORD) {
    throw new Error('Unauthorized');
  }
  return getStats();
};

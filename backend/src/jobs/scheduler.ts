import cron from 'node-cron';

export const scheduler = {
  start() {
    // Bill generation — daily at 2:00 AM
    cron.schedule('0 2 * * *', () => {
      console.log('[Cron] Bill generation check');
    });

    // Dunning escalation — daily at 8:00 AM
    cron.schedule('0 8 * * *', () => {
      console.log('[Cron] Dunning escalation check');
    });

    // Contract expiry check — daily at 7:00 AM
    cron.schedule('0 7 * * *', () => {
      console.log('[Cron] Contract expiry check');
    });

    // Depreciation — last day of month
    cron.schedule('0 2 28-31 * *', () => {
      console.log('[Cron] Depreciation calculation check');
    });

    console.log('Scheduled tasks initialized');
  },
};

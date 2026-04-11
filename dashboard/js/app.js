// Dashboard App — Alpine.js root component
// Loads inventory data and manages refresh cycle

function dashboardApp() {
  return {
    devices: [],
    services: [],
    quotas: [],
    loading: false,
    lastRefresh: 'never',

    get overallStatus() {
      if (this.devices.some(d => d.status === 'offline'))
        return 'degraded';
      if (this.devices.every(d => d.status === 'healthy'))
        return 'healthy';
      return 'unknown';
    },

    async init() {
      await this.loadInventory();
      this.lastRefresh = new Date().toLocaleTimeString();
    },

    async loadInventory() {
      this.devices = await loadDevices();
      this.services = await loadServices();
      this.quotas = buildQuotaList(this.services);
    },

    async refreshAll() {
      this.loading = true;
      try {
        const checks = await runHealthChecks(this.devices);
        this.devices = mergeHealthStatus(this.devices, checks);
        this.lastRefresh = new Date().toLocaleTimeString();
      } finally {
        this.loading = false;
      }
    }
  };
}

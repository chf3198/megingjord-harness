// Dashboard App — Alpine.js root component
// Loads inventory data and manages refresh cycle

function dashboardApp() {
  return {
    devices: [],
    services: [],
    quotas: [],
    liveQuotas: [],
    fleetStats: {},
    routerStats: {},
    config: { refreshSec: 60, highContrast: false },
    currentView: 'ops',
    tooltipsEnabled: false,
    autoRefreshEnabled: true,
    refreshTimer: null,
    testTimer: null,
    testRun: { running: false, rounds: 0, ok: 0, fail: 0, last: 'idle' },
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
      this.config = loadDashboardConfig();
      document.body.classList.toggle('high-contrast', this.config.highContrast);
      this.tooltipsEnabled = !!this.config.tooltipsEnabled;
      initTooltips(this);
      await this.loadInventory();
      await this.refreshAll();
      this.scheduleRefresh();
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
        const ids = this.devices
          .filter(d => d.ollama).map(d => d.id);
        const [checks, stats, lq, routerStats] = await Promise.all([
          runHealthChecks(this.devices),
          fetchAllFleetStats(ids),
          fetchAllLiveQuotas(),
          fetchRouterLaneStats()
        ]);
        this.devices = mergeHealthStatus(this.devices, checks);
        this.fleetStats = stats;
        this.routerStats = routerStats;
        if (lq.length) this.liveQuotas = lq;
        this.lastRefresh = new Date().toLocaleTimeString();
      } finally {
        this.loading = false;
      }
    },

    scheduleRefresh() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (!this.autoRefreshEnabled) return;
      const ms = Math.max(15, Number(this.config.refreshSec || 60)) * 1000;
      this.refreshTimer = setInterval(() => this.refreshAll(), ms);
    },

    toggleAutoRefresh() {
      this.autoRefreshEnabled = !this.autoRefreshEnabled;
      this.scheduleRefresh();
    },

    setHighContrast(on) {
      this.config.highContrast = !!on;
      saveDashboardConfig(this.config);
      document.body.classList.toggle('high-contrast', this.config.highContrast);
    },

    setView(view) { setDashboardView(this, view); },
    isView(view) { return isDashboardView(this, view); },
    toggleTips() { toggleDashboardTips(this); },
    runQuickTest() { return runDashboardQuickTest(this); },

    startTour() { startDashboardTour(); }
  };
}

// Dashboard App — Alpine.js root component

function dashboardApp() {
  return {
    devices: [], services: [], quotas: [], liveQuotas: [],
    fleetStats: {}, routerStats: {},
    config: { refreshSec: 5, highContrast: false },
    currentView: 'fleet', helpDevMode: false,
    batonState: [],
    activityLog: [],
    wikiHealth: { loaded: false },
    wikiPages: [],
    tooltipsEnabled: false, autoRefreshEnabled: true,
    refreshTimer: null, testTimer: null,
    testRun: { running: false, rounds: 0, ok: 0, fail: 0, last: 'idle' },
    activeTip: '', loading: false, lastRefresh: 'never',

    get overallStatus() {
      if (!this.devices.length) return 'loading';
      const checked = this.devices.filter(d => d.status !== 'unknown');
      if (!checked.length) return 'loading';
      if (checked.every(d => d.status === 'healthy')) return 'healthy';
      return 'degraded';
    },

    async init() {
      this.config = loadDashboardConfig();
      document.body.classList.toggle('high-contrast', this.config.highContrast);
      this.tooltipsEnabled = !!this.config.tooltipsEnabled;
      initTooltips(this);
      this.wikiPages = typeof getWikiPages === 'function' ? getWikiPages() : [];
      await this.loadInventory();
      await this.refreshAll();
      this.scheduleRefresh();
      this.lastRefresh = new Date().toLocaleTimeString();
      addActivity(this.activityLog, 'system', 'Dashboard initialized',
        `${this.devices.length} devices loaded`);
    },

    async loadInventory() {
      this.devices = await loadDevices();
      this.services = await loadServices();
      this.quotas = buildQuotaList(this.services);
    },

    async refreshAll() {
      this.loading = true;
      try {
        const ids = this.devices.filter(d => d.ollama).map(d => d.id);
        const [checks, stats, lq, rs, evBaton] = await Promise.all([
          runHealthChecks(this.devices), fetchAllFleetStats(ids),
          fetchAllLiveQuotas(), fetchRouterLaneStats(),
          pollEventBus(this.activityLog)
        ]);
        this.devices = mergeHealthStatus(this.devices, checks);
        this.fleetStats = stats;
        this.routerStats = rs;
        this.batonState = evBaton || buildBatonState(getRouterLog());
        if (lq.length) this.liveQuotas = lq;
        this.wikiHealth = await fetchWikiHealth();
        this.lastRefresh = new Date().toLocaleTimeString();
        const h = this.devices.filter(d => d.status === 'healthy').length;
        addActivity(this.activityLog, 'refresh', 'Fleet refreshed',
          `${h}/${this.devices.length} healthy`);
      } finally {
        this.loading = false;
      }
    },

    scheduleRefresh() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (!this.autoRefreshEnabled) return;
      const ms = Math.max(3, Number(this.config.refreshSec || 5)) * 1000;
      this.refreshTimer = setInterval(() => this.refreshAll(), ms);
    },

    toggleAutoRefresh() {
      this.autoRefreshEnabled = !this.autoRefreshEnabled;
      this.scheduleRefresh();
      addActivity(this.activityLog, 'system',
        this.autoRefreshEnabled ? 'Auto-refresh on' : 'Auto-refresh off');
    },

    setHighContrast(on) {
      this.config.highContrast = !!on;
      saveDashboardConfig(this.config);
      document.body.classList.toggle('high-contrast', this.config.highContrast);
    },

    setView(view) { setDashboardView(this, view); },
    isView(view) { return isDashboardView(this, view); },
    toggleTips() { toggleDashboardTips(this); },
    toggleHelpDevMode() { this.helpDevMode = !this.helpDevMode; },
    runQuickTest() { return runDashboardQuickTest(this); },

    startTour() { startDashboardTour(); }
  };
}

/* global loadDashboardConfig, initTooltips, loadWikiPages, connectSSE, addActivity, loadDevices, loadServices, buildQuotaList, runHealthChecks, fetchAllFleetStats, fetchAllLiveQuotas, fetchRouterLaneStats, pollEventBus, mergeHealthStatus, getTicketLog, fetchWikiHealth, fetchWikiMetrics, pollGitHub, pruneClosedFromGitHub, syncWithGitHub, inferRole, getBatonState, buildBatonState, getRouterLog, fetchFleetHealthLog, fetchGovernanceState, saveDashboardConfig, setDashboardView, isDashboardView, toggleDashboardTips, runDashboardQuickTest */
/** Dashboard Alpine root state. @returns {Object} Alpine component state. */
function dashboardApp() {
  return {
    devices: [], services: [], quotas: [], liveQuotas: [],
    fleetStats: {}, routerStats: {},
    config: { refreshSec: 5, highContrast: false },
    currentView: 'live', helpDevMode: false,
    batonState: [], ticketLog: [], activityLog: [],
    governanceState: {}, wikiHealth: { loaded: false },
    wikiMetrics: null, wikiPages: [], githubData: null,
    fleetHealthLog: [],
    tooltipsEnabled: false, autoRefreshEnabled: true,
    refreshTimer: null, testTimer: null,
    testRun: { running: false, rounds: 0, ok: 0, fail: 0, last: 'idle' },
    activeTip: '', loading: false, lastRefresh: 'initializing…',

    get overallStatus() {
      if (!this.devices.length) return 'initializing';
      const checked = this.devices.filter(d => d.status !== 'unknown');
      if (!checked.length) return 'initializing';
      if (checked.every(d => d.status === 'healthy')) return 'healthy';
      return 'degraded';
    },

    async init() {
      this.config = loadDashboardConfig();
      document.body.classList.toggle('high-contrast', this.config.highContrast);
      this.tooltipsEnabled = !!this.config.tooltipsEnabled;
      initTooltips(this);
      this.wikiPages = typeof loadWikiPages === 'function' ? await loadWikiPages() : [];
      await this.loadInventory();
      await this.refreshAll();
      this.scheduleRefresh();
      if (typeof connectSSE === 'function') connectSSE(this);
      this.lastRefresh = new Date().toLocaleTimeString();
      addActivity(this.activityLog, 'system', 'Dashboard initialized', `${this.devices.length} devices`);
    },
    async loadInventory() {
      this.devices = await loadDevices(); this.services = await loadServices();
      this.quotas = buildQuotaList(this.services);
    },
    async refreshAll() {
      this.loading = true;
      try {
        const ids = this.devices.filter(d => d.ollama).map(d => d.id);
        const results = await Promise.allSettled([
          runHealthChecks(this.devices), fetchAllFleetStats(ids),
          fetchAllLiveQuotas(), fetchRouterLaneStats(),
          pollEventBus(this.activityLog)
        ]);
        const val = (i, fb) => results[i].status === 'fulfilled' ? results[i].value : fb;
        results.filter(r => r.status === 'rejected').forEach(r => console.warn('refreshAll failed:', r.reason));
        const [checks, stats, lq, rs, evBaton] = [val(0,[]), val(1,{}), val(2,[]), val(3,{}), val(4,[])];
        this.devices = mergeHealthStatus(this.devices, checks);
        this.fleetStats = stats; this.routerStats = rs; if (lq.length) this.liveQuotas = lq;
        this.ticketLog = getTicketLog();
        this.wikiHealth = await fetchWikiHealth();
        if (typeof fetchWikiMetrics==='function') this.wikiMetrics=await fetchWikiMetrics();
        if (typeof pollGitHub === 'function') { this.githubData = await pollGitHub();
          if (this.githubData?.issues?.recent) pruneClosedFromGitHub(this.githubData.issues.recent);
          if (typeof syncWithGitHub === 'function' && this.githubData?.issues?.all)
            this.ticketLog = syncWithGitHub(this.githubData.issues.all); }
        this.batonState = this.ticketLog.length
          ? this.ticketLog.filter(t => ['in-progress','review'].includes(t.status))
              .map(t => ({ ...t, activeRole: t.activeRole || inferRole(t.status) }))
          : (evBaton.length ? evBaton : (typeof getBatonState==='function' ? getBatonState() : buildBatonState(getRouterLog())));
        if (typeof fetchFleetHealthLog === 'function') this.fleetHealthLog = await fetchFleetHealthLog();
        if (typeof fetchGovernanceState === 'function') this.governanceState = await fetchGovernanceState();
        this.lastRefresh = new Date().toLocaleTimeString();
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
      addActivity(this.activityLog, 'system', this.autoRefreshEnabled ? 'Auto-refresh on' : 'Auto-refresh off');
    },
    setHighContrast(on) {
      this.config.highContrast = !!on; saveDashboardConfig(this.config);
      document.body.classList.toggle('high-contrast', this.config.highContrast);
    },
    setView(view) { setDashboardView(this, view); },
    isView(view) { return isDashboardView(this, view); },
    toggleTips() { toggleDashboardTips(this); },
    toggleHelpDevMode() { this.helpDevMode = !this.helpDevMode; }, runQuickTest() { return runDashboardQuickTest(this); }
  };
}

window.dashboardApp = dashboardApp;

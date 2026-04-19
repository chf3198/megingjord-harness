// Device Monitor — load inventory JSONs for dashboard
// Fetches from /inventory/ directory

async function loadDevices() {
  try {
    const r = await fetch('../inventory/devices.json');
    const data = await r.json();
    return data.devices.map(d => ({
      id: d.id,
      alias: d.alias,
      role: d.role,
      ram: d.ram?.total || 'unknown',
      modelCount: (d.ollamaModels || []).length,
      tailscaleIP: d.tailscaleIP || null,
      ollama: d.ollama,
      openclaw: !!d.openclaw,
      local: !!d.local,
      status: 'unknown'
    }));
  } catch (e) {
    console.warn('device-monitor: loadDevices failed:', e.message);
    return [];
  }
}

async function loadServices() {
  try {
    const r = await fetch('../inventory/services.json');
    const data = await r.json();
    const all = [
      ...(data.subscriptions || []),
      ...(data.freeTier || []),
      ...(data.selfHosted || []),
    ];
    return all.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type || s.cost ? 'paid' : 'free',
      cost: s.cost || 'free',
      quotas: s.quotas,
      status: s.status
    }));
  } catch (e) {
    console.warn('device-monitor: loadServices failed:', e.message);
    return [];
  }
}

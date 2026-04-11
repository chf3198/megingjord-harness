// Quota Tracker — build quota display from service inventory
// Pure functions, no side effects

function buildQuotaList(services) {
  const quotas = [];
  for (const svc of services) {
    if (!svc.quotas) continue;
    for (const [key, val] of Object.entries(svc.quotas)) {
      if (key === 'note' || !val.limit) continue;
      quotas.push({
        id: `${svc.id}-${key}`,
        name: `${svc.name}: ${formatKey(key)}`,
        limit: val.limit,
        usage: 0,
        percent: 0,
        period: val.period || 'unknown'
      });
    }
  }
  return quotas;
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function updateQuotaUsage(quotas, serviceId, key, used) {
  return quotas.map(q => {
    if (q.id !== `${serviceId}-${key}`) return q;
    const percent = Math.min(100,
      Math.round((used / q.limit) * 100));
    return { ...q, usage: used, percent };
  });
}

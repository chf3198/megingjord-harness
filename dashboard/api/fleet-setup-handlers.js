#!/usr/bin/env node
'use strict';
// #3173 — route table for /api/fleet/setup/* and /api/fleet/inventory.
const { fleetSetupStatus, fleetInventoryPayload } = require('./fleet-setup-status');
const { dispatchFleetSetup } = require('./fleet-setup-actions');

async function handleFleetSetupApi(req, res, requestUrl, jsonRes) {
  if (requestUrl === '/api/fleet/inventory') {
    return jsonRes(res, 200, fleetInventoryPayload());
  }
  if (requestUrl === '/api/fleet/setup/status') {
    return jsonRes(res, 200, fleetSetupStatus());
  }
  const action = requestUrl.replace('/api/fleet/setup/', '');
  if (!['discover', 'credentials', 'probe'].includes(action)) {
    return jsonRes(res, 404, { error: 'unknown fleet setup route' });
  }
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'POST required' });
  try {
    const payload = await dispatchFleetSetup(action, req);
    return jsonRes(res, 200, payload);
  } catch (error) {
    return jsonRes(res, 400, { ok: false, error: error.message });
  }
}

module.exports = { handleFleetSetupApi };

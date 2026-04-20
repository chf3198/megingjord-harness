// Settings Actions — wiring for Add/Edit/Delete/Export/Import
// Uses modal editing via settings-modal.js

function showAddResource() { openEditModal(); }

function editResource(id) { openEditModal(id); }

function removeResource(id) {
  if (!confirm('Remove this resource?')) return;
  deleteFleetResource(id);
  refreshSettingsView();
}

function saveResourceForm(existingId) {
  const provider = document.getElementById('rf-provider').value;
  const preset = getProviderPreset(provider);
  const resource = {
    name: document.getElementById('rf-name').value,
    provider, tier: preset?.tier || 'custom',
    baseUrl: document.getElementById('rf-url').value,
    apiFormat: preset?.apiFormat || 'openai-compat',
    healthEndpoint: preset?.healthEndpoint || '/v1/models',
    modelsEndpoint: preset?.modelsEndpoint || '/v1/models',
    auth: {
      type: document.getElementById('rf-auth').value,
      key: document.getElementById('rf-key').value,
      headerName: preset?.authHeaderName || undefined
    },
    tags: document.getElementById('rf-tags').value
      .split(',').map(t => t.trim()).filter(Boolean),
    enabled: document.getElementById('rf-enabled').checked
  };
  if (existingId) {
    updateFleetResource(existingId, resource);
  } else {
    addFleetResource(resource);
  }
  closeForm();
  refreshSettingsView();
}

function closeForm() { closeModal(); }

async function probeAll() {
  const res = loadFleetResources();
  const results = await probeAllResources(res);
  window._lastProbeResults = results;
  refreshSettingsView();
}

function exportConfig() {
  const json = exportFleetConfig();
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fleet-config-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}

function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const count = importFleetConfig(reader.result);
      alert(`Imported ${count} resources.`);
      refreshSettingsView();
    } catch (e) { alert('Import failed: ' + e.message); }
  };
  reader.readAsText(file);
}

function refreshSettingsView() {
  const el = document.getElementById('settings-content');
  if (!el) return;
  const res = loadFleetResources();
  el.innerHTML = renderSettingsPanel(res, window._lastProbeResults, window._hostInfo);
}

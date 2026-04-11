#!/usr/bin/env node
// Health Check — probe fleet devices and report status
// Usage: node scripts/health-check.js

const http = require('http');

const DEVICES = [
  { id: 'penguin-1', host: 'localhost', port: 11434 },
  { id: 'windows-laptop', host: '100.78.22.13', port: 11434 }
];

function probe(host, port, path, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: host, port, path, timeout },
      (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({
          ok: res.statusCode === 200, body
        }));
      }
    );
    req.on('error', () => resolve({ ok: false, body: '' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, body: '' });
    });
  });
}

async function checkDevice(device) {
  const result = await probe(
    device.host, device.port, '/api/tags'
  );
  if (!result.ok) {
    return { ...device, status: 'offline', models: [] };
  }
  try {
    const data = JSON.parse(result.body);
    const models = (data.models || []).map(m => m.name);
    return { ...device, status: 'healthy', models };
  } catch {
    return { ...device, status: 'error', models: [] };
  }
}

async function main() {
  console.log('DevEnv Fleet Health Check');
  console.log('========================\n');

  for (const device of DEVICES) {
    const r = await checkDevice(device);
    const icon = r.status === 'healthy' ? '✅' : '❌';
    console.log(`${icon} ${r.id} (${r.host}): ${r.status}`);
    if (r.models.length > 0) {
      console.log(`   Models: ${r.models.join(', ')}`);
    }
  }
}

main().catch(console.error);

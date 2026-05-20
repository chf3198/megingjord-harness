'use strict';
const { test, expect } = require('@playwright/test');

let handler; let projects;

// Reload modules fresh each test to isolate cache state
function load() {
  const hPath = require.resolve('../dashboard/api/projects-v2-handlers.js');
  const pPath = require.resolve('../scripts/global/projects-v2-state.js');
  delete require.cache[hPath]; delete require.cache[pPath];
  handler = require('../dashboard/api/projects-v2-handlers.js');
  projects = require('../scripts/global/projects-v2-state.js');
}

function fakeRes() {
  const chunks = []; let code = 0; let hdrs = {};
  return {
    writeHead(c, h) { code = c; hdrs = h || {}; },
    end(body) { chunks.push(body); },
    get statusCode() { return code; },
    get body() { return JSON.parse(chunks.join('')); },
  };
}

test('returns disabled=true when MEGINGJORD_PROJECTS_V2_DISABLED=1', async () => {
  load(); process.env.MEGINGJORD_PROJECTS_V2_DISABLED = '1';
  const res = fakeRes();
  await handler.handleProjectsV2InFlight({}, res);
  delete process.env.MEGINGJORD_PROJECTS_V2_DISABLED;
  expect(res.body).toMatchObject({ items: [], disabled: true });
  expect(res.statusCode).toBe(200);
});

test('returns missing-config when GITHUB_TOKEN absent', async () => {
  load(); delete process.env.GITHUB_TOKEN; delete process.env.MEGINGJORD_PROJECTS_V2_ID;
  const res = fakeRes();
  await handler.handleProjectsV2InFlight({}, res);
  expect(res.body).toMatchObject({ items: [], reason: 'missing-config' });
  expect(res.statusCode).toBe(200);
});

test('returns items array from listInFlight result', async () => {
  load();
  process.env.GITHUB_TOKEN = 'tok'; process.env.MEGINGJORD_PROJECTS_V2_ID = 'P_ID';
  const origList = projects.listInFlight;
  projects.listInFlight = async () => [{ id: 'ITEM_1', title: 'in-flight task' }];
  const res = fakeRes();
  await handler.handleProjectsV2InFlight({}, res);
  projects.listInFlight = origList;
  delete process.env.GITHUB_TOKEN; delete process.env.MEGINGJORD_PROJECTS_V2_ID;
  expect(res.body).toMatchObject({ items: [{ id: 'ITEM_1' }] });
  expect(res.statusCode).toBe(200);
});

test('serves from cache within 60s window', async () => {
  load();
  process.env.GITHUB_TOKEN = 'tok'; process.env.MEGINGJORD_PROJECTS_V2_ID = 'P_ID';
  let callCount = 0;
  const origList = projects.listInFlight;
  projects.listInFlight = async () => { callCount++; return [{ id: 'C1' }]; };
  await handler.handleProjectsV2InFlight({}, fakeRes());
  await handler.handleProjectsV2InFlight({}, fakeRes());
  projects.listInFlight = origList;
  delete process.env.GITHUB_TOKEN; delete process.env.MEGINGJORD_PROJECTS_V2_ID;
  expect(callCount).toBe(1);
});

test('response shape has items array', async () => {
  load();
  process.env.GITHUB_TOKEN = 'tok'; process.env.MEGINGJORD_PROJECTS_V2_ID = 'P_ID';
  const origList = projects.listInFlight;
  projects.listInFlight = async () => [];
  const res = fakeRes();
  await handler.handleProjectsV2InFlight({}, res);
  projects.listInFlight = origList;
  delete process.env.GITHUB_TOKEN; delete process.env.MEGINGJORD_PROJECTS_V2_ID;
  expect(Array.isArray(res.body.items)).toBe(true);
});

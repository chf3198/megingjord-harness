#!/usr/bin/env node
'use strict';
// #3014 — role-scoped governance bundle field keys (v2 extension).
const ROLE_FIELD_KEYS = {
  manager: ['scope', 'acceptance_criteria', 'child_tickets'],
  collaborator: ['checks_run', 'checks_failed', 'test_strategy', 'cross_family_rating'],
  admin: ['branch', 'commit', 'pr_url', 'ci_green', 'sync_verification'],
  consultant: ['verdict', 'rubric_rating', 'drift_score', 'fleet_utilization', 'wiki_health'],
};
const ALL_KEYS = [...new Set(Object.values(ROLE_FIELD_KEYS).flat())];
module.exports = { ROLE_FIELD_KEYS, ALL_KEYS };

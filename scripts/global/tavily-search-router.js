#!/usr/bin/env node
'use strict';

const { evaluateTavilyBudget } = require('./tavily-budget-governor');

/**
 * Route search request with free-first then governed Tavily behavior.
 * @param {{query:string, freeEligible?:boolean, tavilyAvailable?:boolean, policyAllowsTavily?:boolean,
 * spentUsd?:number, allowPaid?:boolean, correlationId?:string}} input
 * @returns {{provider:string, lane:string, routeLabel:string, reason:string, observability:object,
 * budgetDecision:object}}
 */
function routeSearch(input = {}) {
  const query = String(input.query || '').trim();
  if (!query) {
    return {
      provider: 'none', lane: 'free', routeLabel: 'tavily-free', reason: 'invalid-query',
      observability: { correlationId: input.correlationId || null, decisionOrder: ['free', 'tavily', 'fallback'] },
      budgetDecision: { decision: 'invalid-query' },
    };
  }
  if (input.freeEligible !== false) {
    return {
      provider: 'local-rag', lane: 'free', routeLabel: 'tavily-free', reason: 'free-first',
      observability: { correlationId: input.correlationId || null, decisionOrder: ['free', 'tavily', 'fallback'] },
      budgetDecision: { decision: 'free-first' },
    };
  }
  const budget = evaluateTavilyBudget({
    spentUsd: input.spentUsd,
    policy: input.policy,
    allowPaid: input.allowPaid,
  });
  const allowed = input.policyAllowsTavily !== false;
  const available = input.tavilyAvailable !== false;
  if (allowed && available && !budget.hardBlocked) {
    return {
      provider: 'tavily', lane: 'haiku', routeLabel: budget.routeLabel, reason: 'policy-allowed',
      observability: { correlationId: input.correlationId || null, decisionOrder: ['free', 'tavily', 'fallback'] },
      budgetDecision: budget.budgetDecision,
    };
  }
  return {
    provider: 'free-cloud', lane: 'free', routeLabel: 'tavily-free',
    reason: !allowed ? 'policy-blocked' : (!available ? 'provider-unavailable' : 'hard-cap-fallback'),
    observability: { correlationId: input.correlationId || null, decisionOrder: ['free', 'tavily', 'fallback'] },
    budgetDecision: budget.budgetDecision,
  };
}

module.exports = { routeSearch };

if (require.main === module) {
  const q = process.argv.slice(2).join(' ');
  process.stdout.write(JSON.stringify(routeSearch({ query: q }), null, 2) + '\n');
}

'use strict';
// Goal-lens ordering (Epic #2508 core primitive). Pure, dependency-free.
// G1 Governance > G2 Quality > G3 Zero-Cost > G4 Privacy > G5 Portability >
// G6 Resilience > G7 Throughput > G8 Observability > G9 Interop > G10 Maintainability.
const ORDER = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'];

/** @returns {import('../index').GoalLens} */
function createGoalLens() {
  const rankOf = (goal) => {
    const i = ORDER.indexOf(goal);
    if (i < 0) throw new RangeError(`unknown goal: ${goal}`);
    return i;
  };
  return {
    order: Object.freeze(ORDER.slice()),
    rank: rankOf,
    compare: (a, b) => rankOf(a) - rankOf(b),
  };
}

module.exports = { ORDER, createGoalLens };

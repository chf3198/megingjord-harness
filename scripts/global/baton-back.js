'use strict';
// baton-back.js (Epic #3251, Phase-1 child #3257): the baton-back state primitive.
//
// Records a remediation routing decision when a review phase surfaces an issue,
// enforces the close-gate invariant (a ticket cannot close while remediation is
// open), and bounds the remediation loop with a NON-blocking escalation. Pure,
// dependency-free, and deterministic so it enforces for $0 and survives context
// loss (the authoritative copy is mirrored to the server-side issue/PR timeline).
//
// Routing authority: the Phase-0 identification matrix (#3252).

const DEFAULT_MAX_CYCLES = 3;

// Deterministic remediation routing — no LLM, no instructions.
// `finding` carries mutually-considered flags describing what a fix would touch:
//   { touchesFile, ownArtifactOrGitOp, governanceMetadata, environmental, currentRole }
// Returns { remediator, impact }.
function routeRemediation(finding = {}) {
  if (finding.environmental) return { remediator: null, impact: 'override' };
  if (finding.touchesFile) return { remediator: 'collaborator', impact: 'baton-back' };
  if (finding.governanceMetadata) return { remediator: 'manager', impact: 'hold' };
  if (finding.ownArtifactOrGitOp) {
    return { remediator: finding.currentRole || 'current', impact: 'block-in-place' };
  }
  // An unclassified BUT blocking finding must never silently pass: route to a
  // Manager hold so a human-class owner triages it.
  return { remediator: 'manager', impact: 'hold' };
}

// Build an open baton-back marker from a routed finding plus its provenance.
function openMarker(finding = {}, meta = {}) {
  const { remediator, impact } = routeRemediation(finding);
  return {
    open: true,
    source: meta.source || 'layerA',
    detector: meta.detector || null,
    remediator,
    impact,
    finding_ref: meta.finding_ref || null,
    lesson: meta.lesson || null,
    grounding: meta.grounding || 'none',
    review: meta.review || null,
    cycle: 1,
  };
}

function isOpen(marker) {
  return Boolean(marker && marker.open === true);
}

// The close-gate invariant: a ticket may not reach done/closed while a
// baton-back marker is still open.
function closeGateAllows(marker) {
  return !isOpen(marker);
}

// Clear the marker ONLY when the owning detector re-passes after remediation.
function clearMarker(marker, detectorPassed) {
  if (!isOpen(marker) || !detectorPassed) return marker;
  return { ...marker, open: false };
}

// Bounded, NON-blocking escalation. On exceeding maxCycles the loop neither
// spins forever nor blocks on a timer thread: it escalates to a Tier-2 anneal
// and parks the ticket as deferred for an async client/UAT decision.
function nextCycle(marker, maxCycles = DEFAULT_MAX_CYCLES) {
  const cycle = (marker.cycle || 1) + 1;
  if (cycle > maxCycles) {
    return {
      ...marker,
      cycle,
      escalate: true,
      escalation: {
        kind: 'tier2-anneal',
        park: 'status:deferred',
        blocking: false,
        pattern_id: 'baton-back-nonconverging',
      },
    };
  }
  return { ...marker, cycle, escalate: false };
}

module.exports = {
  DEFAULT_MAX_CYCLES,
  routeRemediation,
  openMarker,
  isOpen,
  closeGateAllows,
  clearMarker,
  nextCycle,
};

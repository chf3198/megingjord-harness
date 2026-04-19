(function() { // Baton Filter — dropdown filter for epic and status

let _batonFilter = { epic: '', status: '' };

function getBatonFilter() { return _batonFilter; }
function setBatonFilter(key, val) {
  _batonFilter[key] = val;
  const el = document.querySelector('[x-data]');
  if (el && typeof Alpine !== 'undefined') {
    const data = Alpine.$data(el);
    if (data) data.batonState = [...data.batonState];
  }
}

function applyBatonFilter(tickets) {
  const f = _batonFilter;
  return tickets.filter(t =>
    (!f.epic || String(t.epic) === f.epic) &&
    (!f.status || t.status === f.status));
}

function renderBatonFilterBar(tickets) {
  const epics = [...new Set(tickets.map(t => t.epic).filter(Boolean))].sort();
  const statuses = [...new Set(tickets.map(t => t.status).filter(Boolean))];
  const f = _batonFilter;
  const epicOpts = epics.map(e =>
    `<option value="${e}" ${f.epic == e ? 'selected' : ''}>Epic #${e}</option>`
  ).join('');
  const statusOpts = statuses.map(s =>
    `<option value="${s}" ${f.status === s ? 'selected' : ''}>${esc(s)}</option>`
  ).join('');
  return `<div class="baton-filter-bar">
    <select onchange="setBatonFilter('epic',this.value)" title="Filter by epic">
      <option value="">All epics</option>${epicOpts}</select>
    <select onchange="setBatonFilter('status',this.value)" title="Filter by status">
      <option value="">All statuses</option>${statusOpts}</select>
  </div>`;
}
if(typeof module!=="undefined")module.exports={getBatonFilter,setBatonFilter,applyBatonFilter,renderBatonFilterBar};else Object.assign(window,{getBatonFilter,setBatonFilter,applyBatonFilter,renderBatonFilterBar});
})();

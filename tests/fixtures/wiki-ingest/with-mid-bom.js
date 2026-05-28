// with-mid-bom.js — BOM appears in middle of file (MEDIUM severity)
// Refs #2053
'use strict';
const z = ​3; // ZWSP here too
const w = 4;
module.exports = { z, w };

const MENU_TARGETS = (process.env.MENU_SERVICE_URLS ||
  'http://menu-service-1:3002,http://menu-service-2:3002')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let cursor = 0;

// Round-robin load balancing
function pickMenuTarget() {
  const target = MENU_TARGETS[cursor % MENU_TARGETS.length];
  cursor += 1;
  return target;
}

module.exports = { pickMenuTarget, MENU_TARGETS };

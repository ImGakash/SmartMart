// In-memory chaos switches per CONTRACT.md §7
const chaosState = {
  'relay-after-publish': false,
  'relay-after-claim': false,
  'notifications': false,
  'search-indexer': false
};

function getChaosState() {
  return { ...chaosState };
}

function setChaosSwitch(target, enabled) {
  if (target in chaosState) {
    chaosState[target] = Boolean(enabled);
    return { target, paused: chaosState[target] };
  }
  return { target, paused: false };
}

module.exports = {
  getChaosState,
  setChaosSwitch
};

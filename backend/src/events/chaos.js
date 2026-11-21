const chaos = {
  relay: false,
  'relay-after-publish': false,
  notifications: false,
  'search-indexer': false
};

function getChaosState() {
  return { ...chaos };
}

function setChaosSwitch(target, enabled) {
  if (target in chaos) {
    chaos[target] = Boolean(enabled);
    return { target, paused: chaos[target] };
  }
  throw new Error(`Unknown chaos switch target: ${target}`);
}

function consumeOneShotRelayAfterPublish(eventType) {
  if (chaos['relay-after-publish'] && eventType === 'OrderPlaced') {
    chaos['relay-after-publish'] = false;
    return true;
  }
  return false;
}

module.exports = {
  chaos,
  getChaosState,
  setChaosSwitch,
  consumeOneShotRelayAfterPublish
};
function createUpgradeEngine(config) {
  const { getInventory, getAllSkins, removeInventoryItem, addInventoryItem, setResultText } = config;
  const state = { mul: 2, percent: 50, selectedInventoryId: "" };

  function setMultiplier(mul) {
    state.mul = mul;
  }

  function setPercent(percent) {
    state.percent = percent;
  }

  function setSelectedInventoryId(id) {
    state.selectedInventoryId = id;
  }

  function pickTarget() {
    const inventory = getInventory();
    const source = inventory.find((item) => item.id === state.selectedInventoryId);
    if (!source) return null;
    const targetBase = source.price * state.mul;
    const min = targetBase * 0.9;
    const max = targetBase * 1.1;
    const pool = getAllSkins().filter((skin) => skin.price >= min && skin.price <= max);
    const fallback = getAllSkins().sort((a, b) => Math.abs(a.price - targetBase) - Math.abs(b.price - targetBase));
    return (pool[0] || fallback[0] || null);
  }

  function runUpgrade() {
    const inventory = getInventory();
    const source = inventory.find((item) => item.id === state.selectedInventoryId);
    if (!source) {
      setResultText("Select an item in your inventory.");
      return null;
    }
    const target = pickTarget();
    if (!target) {
      setResultText("Target skin not found.");
      return null;
    }
    const success = Math.random() * 100 <= state.percent;
    removeInventoryItem(source.id);
    if (success) {
      addInventoryItem({ ...target });
      setResultText(`Success ${state.percent}%: ${source.name} -> ${target.name}`);
      return { success: true, target };
    }

    const cheaper = getAllSkins()
      .filter((skin) => skin.price <= source.price)
      .sort((a, b) => b.price - a.price);
    const failItem = cheaper[0] || source;
    addInventoryItem({ ...failItem });
    setResultText(`Failed: received ${failItem.name}`);
    return { success: false, target: failItem };
  }

  return {
    state,
    setMultiplier,
    setPercent,
    setSelectedInventoryId,
    pickTarget,
    runUpgrade
  };
}

window.createUpgradeEngine = createUpgradeEngine;

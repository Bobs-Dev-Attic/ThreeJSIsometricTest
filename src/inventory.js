/**
 * Player inventory plus two UIs:
 *  - the loot interface (chest contents beside the inventory) shown when a
 *    chest is open; click an item to take it, or "Take All".
 *  - a standalone inventory panel toggled any time (button / "I" key).
 *
 * Items look like: { id, name, type, icon, qty }. Taking an item stacks it by
 * id in the inventory and removes it from the chest's contents array (which is
 * mutated in place, so a re-opened chest shows what's left).
 */
export function createInventory() {
  const app = document.getElementById('app');
  const player = []; // collected items

  // --- DOM -----------------------------------------------------------------
  const loot = document.createElement('div');
  loot.id = 'loot';
  loot.className = 'panel';
  loot.innerHTML = `
    <div class="loot-cols">
      <div class="loot-col">
        <div class="loot-head"><h3>Chest</h3><button class="btn take-all">Take All</button></div>
        <div class="slots chest-slots"></div>
      </div>
      <div class="loot-col">
        <div class="loot-head"><h3>Inventory</h3></div>
        <div class="slots inv-slots"></div>
      </div>
    </div>
    <div class="panel-hint">Click an item to take it · walk away to close</div>
  `;
  app.appendChild(loot);

  const inv = document.createElement('div');
  inv.id = 'inventory';
  inv.className = 'panel';
  inv.innerHTML = `
    <div class="loot-head"><h3>Inventory</h3><button class="btn inv-close">Close</button></div>
    <div class="slots inv-only-slots"></div>
    <div class="panel-hint">Press I to close</div>
  `;
  app.appendChild(inv);

  // HUD button to open the inventory any time.
  const invBtn = document.createElement('button');
  invBtn.id = 'inv-button';
  invBtn.textContent = '🎒 Inventory (I)';
  app.appendChild(invBtn);

  // Keep panel/button clicks from reaching the canvas (no accidental moves).
  [loot, inv, invBtn].forEach((el) => el.addEventListener('pointerdown', (e) => e.stopPropagation()));

  const chestSlots = loot.querySelector('.chest-slots');
  const invSlots = loot.querySelector('.inv-slots');
  const invOnlySlots = inv.querySelector('.inv-only-slots');

  let chestItems = null;

  // --- helpers -------------------------------------------------------------
  function addToPlayer(item, qty) {
    const existing = player.find((p) => p.id === item.id);
    if (existing) existing.qty += qty;
    else player.push({ ...item, qty });
  }

  function makeSlot(item, onClick) {
    const slot = document.createElement('div');
    slot.className = `slot type-${item.type}`;
    slot.innerHTML = `
      <div class="slot-icon">${item.icon}</div>
      <div class="slot-name">${item.name}</div>
      ${item.qty > 1 ? `<div class="slot-qty">×${item.qty}</div>` : ''}
    `;
    if (onClick) {
      slot.classList.add('clickable');
      slot.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        onClick(item);
      });
    }
    return slot;
  }

  function renderSlots(container, items, onClick) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'slots-empty';
      empty.textContent = 'Empty';
      container.appendChild(empty);
      return;
    }
    for (const item of items) container.appendChild(makeSlot(item, onClick));
  }

  function renderLoot() {
    renderSlots(chestSlots, chestItems, takeItem);
    renderSlots(invSlots, player, null);
  }

  function takeItem(item) {
    addToPlayer(item, item.qty);
    const i = chestItems.indexOf(item);
    if (i >= 0) chestItems.splice(i, 1);
    renderLoot();
  }

  loot.querySelector('.take-all').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!chestItems) return;
    for (const item of chestItems) addToPlayer(item, item.qty);
    chestItems.length = 0;
    renderLoot();
  });

  inv.querySelector('.inv-close').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    inv.classList.remove('show');
  });
  invBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    toggleInventory();
  });

  // --- public API ----------------------------------------------------------
  function openChest(items) {
    chestItems = items;
    renderLoot();
    loot.classList.add('show');
  }
  function closeChest() {
    loot.classList.remove('show');
  }
  function toggleInventory() {
    if (inv.classList.contains('show')) {
      inv.classList.remove('show');
    } else {
      renderSlots(invOnlySlots, player, null);
      inv.classList.add('show');
    }
  }

  return {
    openChest,
    closeChest,
    toggleInventory,
    get chestVisible() {
      return loot.classList.contains('show');
    },
    items: player,
  };
}

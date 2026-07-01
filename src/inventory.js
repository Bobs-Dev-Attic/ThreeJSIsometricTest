import {
  EQUIP_SLOTS,
  SLOT_LABELS,
  SLOT_ICONS,
  RARITIES,
  ATTR_KEYS,
  ATTR_LABELS,
  prettyKey,
} from './items.js';

/**
 * Player inventory + equipment + derived character stats, with UI:
 *  - a bag of limited slots governed by a weight/carry-capacity limit
 *  - an equipment paperdoll (helmet, chest, gloves, belt, boots, weapon, shield)
 *  - a character sheet (attributes, armour, damage, health, weight, gold)
 *  - a chest loot panel; hover tooltips describe every item
 *
 * Equipping recomputes stats and fires `onEquipChange(equipment)` so the 3D
 * character can show the gear.
 */
const BAG_SLOTS = 20;
const BASE_ATTR = { strength: 10, dexterity: 10, vitality: 10, intellect: 10 };
const BASE_CARRY = 30;
const CARRY_PER_STR = 4;

export function createInventory({ onEquipChange } = {}) {
  const app = document.getElementById('app');

  // ---- state --------------------------------------------------------------
  const bag = new Array(BAG_SLOTS).fill(null);
  const equipment = { head: null, chest: null, hands: null, waist: null, feet: null, mainHand: null, offHand: null };
  const attributes = { ...BASE_ATTR };
  let gold = 0;
  let chestItems = null;

  // ---- derived stats ------------------------------------------------------
  function computeStats() {
    const eff = { ...attributes };
    let armor = 0;
    const resist = {};
    for (const slot of EQUIP_SLOTS) {
      const it = equipment[slot];
      if (!it) continue;
      if (it.stats?.armor) armor += it.stats.armor;
      for (const k of ATTR_KEYS) if (it.attributes?.[k]) eff[k] += it.attributes[k];
      for (const k in it.resist || {}) resist[k] = (resist[k] || 0) + it.resist[k];
    }
    armor += Math.floor(eff.dexterity / 5);
    const weapon = equipment.mainHand;
    const damage = (weapon?.stats?.damage || 2) + Math.floor(eff.strength / 4);
    const maxHealth = 50 + eff.vitality * 10;
    const capacity = BASE_CARRY + eff.strength * CARRY_PER_STR;

    let weight = 0;
    for (const it of bag) if (it) weight += it.weight * (it.qty || 1);
    for (const slot of EQUIP_SLOTS) if (equipment[slot]) weight += equipment[slot].weight;

    return { eff, armor, damage, maxHealth, capacity, weight: Math.round(weight * 10) / 10, resist };
  }

  let health = computeStats().maxHealth * 0.55; // weary from the road

  // ---- inventory operations ----------------------------------------------
  function firstEmpty() {
    return bag.findIndex((s) => s === null);
  }

  // Try to add an item. Returns { ok, reason }.
  function addItem(item) {
    if (item.baseId === 'coins') {
      gold += item.qty;
      renderAll();
      return { ok: true };
    }
    const stats = computeStats();
    const addWeight = item.weight * (item.qty || 1);
    if (stats.weight + addWeight > stats.capacity) return { ok: false, reason: 'Too heavy to carry' };

    if (item.stackable) {
      const stack = bag.find((s) => s && s.baseId === item.baseId);
      if (stack) {
        stack.qty += item.qty;
        renderAll();
        return { ok: true };
      }
    }
    const idx = firstEmpty();
    if (idx < 0) return { ok: false, reason: 'Inventory full' };
    bag[idx] = item;
    renderAll();
    return { ok: true };
  }

  function equip(bagIndex) {
    const item = bag[bagIndex];
    if (!item || !item.slot) return;
    const prev = equipment[item.slot];
    equipment[item.slot] = item;
    bag[bagIndex] = prev; // swap (prev may be null)
    onEquipChange?.(equipment);
    renderAll();
  }

  function unequip(slot) {
    const item = equipment[slot];
    if (!item) return;
    const idx = firstEmpty();
    if (idx < 0) {
      toast('No room to unequip');
      return;
    }
    bag[idx] = item;
    equipment[slot] = null;
    onEquipChange?.(equipment);
    renderAll();
  }

  function useItem(bagIndex) {
    const item = bag[bagIndex];
    if (!item) return;
    if (item.slot) {
      equip(bagIndex);
      return;
    }
    if (item.use?.health) {
      const stats = computeStats();
      if (health >= stats.maxHealth) {
        toast('Already at full health');
        return;
      }
      health = Math.min(stats.maxHealth, health + item.use.health);
      item.qty -= 1;
      if (item.qty <= 0) bag[bagIndex] = null;
      toast(`Used ${item.name} (+${item.use.health} HP)`);
      renderAll();
    }
  }

  function dropItem(bagIndex) {
    if (bag[bagIndex]) {
      bag[bagIndex] = null;
      renderAll();
    }
  }

  function takeFromChest(item) {
    const res = addItem(item);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    const i = chestItems.indexOf(item);
    if (i >= 0) chestItems.splice(i, 1);
    renderAll();
  }

  // ---- DOM ----------------------------------------------------------------
  const charPanel = el('div', 'panel', { id: 'char-panel' });
  charPanel.innerHTML = `
    <div class="loot-head"><h3>Character</h3><button class="btn char-close">Close</button></div>
    <div class="char-cols">
      <div class="paperdoll"></div>
      <div class="char-stats"></div>
      <div class="bag-col">
        <div class="bag-head">Backpack <span class="bag-weight"></span></div>
        <div class="slots bag-slots"></div>
      </div>
    </div>
    <div class="panel-hint">Click gear to equip · consumables to use · right-click to drop</div>`;
  app.appendChild(charPanel);

  const lootPanel = el('div', 'panel', { id: 'loot-panel' });
  lootPanel.innerHTML = `
    <div class="loot-head"><h3>Chest</h3><button class="btn take-all">Take All</button></div>
    <div class="slots chest-slots"></div>
    <div class="panel-hint">Click an item to take it · walk away to close</div>`;
  app.appendChild(lootPanel);

  const invBtn = el('button', null, { id: 'inv-button' });
  invBtn.textContent = '🎒 Character (I)';
  app.appendChild(invBtn);

  const hud = el('div', null, { id: 'hud-stats' });
  app.appendChild(hud);

  const tooltip = el('div', null, { id: 'item-tooltip' });
  app.appendChild(tooltip);

  const toastEl = el('div', null, { id: 'toast' });
  app.appendChild(toastEl);

  [charPanel, lootPanel, invBtn, hud].forEach((n) => n.addEventListener('pointerdown', (e) => e.stopPropagation()));

  const paperdollEl = charPanel.querySelector('.paperdoll');
  const statsEl = charPanel.querySelector('.char-stats');
  const bagEl = charPanel.querySelector('.bag-slots');
  const bagWeightEl = charPanel.querySelector('.bag-weight');
  const chestEl = lootPanel.querySelector('.chest-slots');

  charPanel.querySelector('.char-close').addEventListener('click', () => charPanel.classList.remove('show'));
  lootPanel.querySelector('.take-all').addEventListener('click', () => {
    if (!chestItems) return;
    for (const item of chestItems.slice()) takeFromChest(item);
    if (chestItems.length) toast('Not everything fit');
  });
  invBtn.addEventListener('click', toggleCharacter);

  // ---- tooltip ------------------------------------------------------------
  let tipVisible = false;
  function tipHtml(item) {
    const R = RARITIES[item.rarity] || RARITIES.common;
    const lines = [];
    lines.push(`<div class="tip-name" style="color:${R.color}">${item.icon} ${item.name}</div>`);
    const type = item.slot ? SLOT_LABELS[item.slot] : item.category === 'consumable' ? 'Consumable' : 'Misc';
    lines.push(`<div class="tip-sub">${R.name} ${type}${item.itemLevel ? ` · iLvl ${item.itemLevel}` : ''}</div>`);
    if (item.stats?.damage) lines.push(`<div>⚔️ ${item.stats.damage} Damage</div>`);
    if (item.stats?.armor) lines.push(`<div>🛡️ ${item.stats.armor} Armor</div>`);
    if (item.use?.health) lines.push(`<div class="tip-attr">Restores ${item.use.health} HP</div>`);
    // Magical powers (these already include any attribute/resist bonuses).
    if (item.magic?.length) lines.push(`<div class="tip-magic">✦ ${item.magic.join(' · ')}</div>`);
    lines.push(`<div class="tip-foot">Weight ${item.weight} · Value ${item.value}${item.qty > 1 ? ` · ×${item.qty}` : ''}</div>`);
    return lines.join('');
  }
  function showTip(item, x, y) {
    tooltip.innerHTML = tipHtml(item);
    tooltip.classList.add('show');
    tipVisible = true;
    moveTip(x, y);
  }
  function moveTip(x, y) {
    const pad = 14;
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    let nx = x + pad;
    let ny = y + pad;
    if (nx + w > window.innerWidth) nx = x - w - pad;
    if (ny + h > window.innerHeight) ny = y - h - pad;
    tooltip.style.left = `${Math.max(4, nx)}px`;
    tooltip.style.top = `${Math.max(4, ny)}px`;
  }
  function hideTip() {
    tooltip.classList.remove('show');
    tipVisible = false;
  }
  window.addEventListener('mousemove', (e) => {
    if (tipVisible) moveTip(e.clientX, e.clientY);
  });

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // ---- rendering ----------------------------------------------------------
  function slotCell(item, opts = {}) {
    const cell = el('div', 'slot');
    if (item) {
      const R = RARITIES[item.rarity] || RARITIES.common;
      cell.style.borderColor = R.color;
      cell.classList.add('filled');
      cell.innerHTML = `<div class="slot-icon">${item.icon}</div>${item.qty > 1 ? `<div class="slot-qty">×${item.qty}</div>` : ''}`;
      cell.addEventListener('mouseenter', (e) => showTip(item, e.clientX, e.clientY));
      cell.addEventListener('mouseleave', hideTip);
    }
    if (opts.onClick) {
      cell.classList.add('clickable');
      cell.addEventListener('click', () => {
        hideTip();
        opts.onClick();
      });
    }
    if (opts.onContext) {
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        hideTip();
        opts.onContext();
      });
    }
    return cell;
  }

  function renderPaperdoll() {
    paperdollEl.innerHTML = '<div class="paperdoll-title">Equipment</div>';
    for (const slot of EQUIP_SLOTS) {
      const item = equipment[slot];
      const row = el('div', 'equip-row');
      const label = el('div', 'equip-label');
      label.textContent = SLOT_LABELS[slot];
      const cell = slotCell(item, item ? { onClick: () => unequip(slot) } : {});
      cell.classList.add('equip-cell');
      if (!item) cell.innerHTML = `<div class="slot-icon empty">${SLOT_ICONS[slot]}</div>`;
      row.appendChild(cell);
      row.appendChild(label);
      paperdollEl.appendChild(row);
    }
  }

  function renderStats() {
    const s = computeStats();
    if (health > s.maxHealth) health = s.maxHealth;
    const overweight = s.weight > s.capacity;
    const hpPct = Math.max(0, Math.round((health / s.maxHealth) * 100));
    const rows = [];
    rows.push(`<div class="stat-bar"><span>Health</span><div class="bar"><div class="bar-fill hp" style="width:${hpPct}%"></div></div><b>${Math.round(health)}/${s.maxHealth}</b></div>`);
    rows.push(`<div class="stat-line"><span>⚔️ Damage</span><b>${s.damage}</b></div>`);
    rows.push(`<div class="stat-line"><span>🛡️ Armor</span><b>${s.armor}</b></div>`);
    rows.push(
      `<div class="stat-line ${overweight ? 'over' : ''}"><span>⚖️ Weight</span><b>${s.weight}/${s.capacity}${overweight ? ' (Overloaded)' : ''}</b></div>`
    );
    rows.push(`<div class="stat-line"><span>🪙 Gold</span><b>${gold}</b></div>`);
    rows.push('<div class="stat-div"></div>');
    for (const k of ATTR_KEYS) {
      const bonus = s.eff[k] - attributes[k];
      rows.push(
        `<div class="stat-line"><span>${ATTR_LABELS[k]}</span><b>${s.eff[k]}${bonus ? ` <em>(+${bonus})</em>` : ''}</b></div>`
      );
    }
    statsEl.innerHTML = `<div class="paperdoll-title">Attributes</div>${rows.join('')}`;
  }

  function renderBag() {
    const s = computeStats();
    bagWeightEl.textContent = `${s.weight}/${s.capacity} ⚖️`;
    bagWeightEl.classList.toggle('over', s.weight > s.capacity);
    bagEl.innerHTML = '';
    for (let i = 0; i < BAG_SLOTS; i++) {
      const item = bag[i];
      const cell = slotCell(item, item ? { onClick: () => useItem(i), onContext: () => dropItem(i) } : {});
      bagEl.appendChild(cell);
    }
  }

  function renderLoot() {
    chestEl.innerHTML = '';
    if (!chestItems || chestItems.length === 0) {
      chestEl.innerHTML = '<div class="slots-empty">Empty</div>';
      return;
    }
    for (const item of chestItems) chestEl.appendChild(slotCell(item, { onClick: () => takeFromChest(item) }));
  }

  function renderHud() {
    const s = computeStats();
    hud.innerHTML =
      `<span class="hud-hp">❤ ${Math.round(health)}/${s.maxHealth}</span>` +
      `<span>🛡️ ${s.armor}</span><span>⚔️ ${s.damage}</span>` +
      `<span class="${s.weight > s.capacity ? 'over' : ''}">⚖️ ${s.weight}/${s.capacity}</span>` +
      `<span>🪙 ${gold}</span>`;
  }

  function renderAll() {
    renderPaperdoll();
    renderStats();
    renderBag();
    renderHud();
    if (lootPanel.classList.contains('show')) renderLoot();
  }

  // ---- public API ---------------------------------------------------------
  function openChest(items) {
    chestItems = items;
    renderLoot();
    lootPanel.classList.add('show');
    charPanel.classList.add('show');
    document.body.classList.add('looting');
  }
  function closeChest() {
    lootPanel.classList.remove('show');
    charPanel.classList.remove('show');
    document.body.classList.remove('looting');
  }
  function toggleCharacter() {
    charPanel.classList.toggle('show');
  }

  onEquipChange?.(equipment);
  renderAll();

  return {
    openChest,
    closeChest,
    toggleInventory: toggleCharacter,
    addItem,
    get chestVisible() {
      return lootPanel.classList.contains('show');
    },
  };
}

function el(tag, className, attrs) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

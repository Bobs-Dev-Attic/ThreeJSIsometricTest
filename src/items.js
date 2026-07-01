/**
 * Item taxonomy for the RPG: categories, equip slots, rarity tiers, magical
 * affixes and base item types, plus `makeItem()` which rolls a concrete item
 * instance (scaled by rarity + item level, with magical powers) and a few
 * helpers for the inventory/UI.
 */

// Equipment slots (the character paperdoll).
export const EQUIP_SLOTS = ['head', 'chest', 'hands', 'waist', 'feet', 'mainHand', 'offHand'];
export const SLOT_LABELS = {
  head: 'Helmet',
  chest: 'Chestplate',
  hands: 'Gloves',
  waist: 'Belt',
  feet: 'Boots',
  mainHand: 'Weapon',
  offHand: 'Shield',
};
export const SLOT_ICONS = {
  head: '⛑️',
  chest: '🦺',
  hands: '🧤',
  waist: '🎗️',
  feet: '🥾',
  mainHand: '⚔️',
  offHand: '🛡️',
};

export const ATTR_KEYS = ['strength', 'dexterity', 'vitality', 'intellect'];
export const ATTR_LABELS = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  vitality: 'Vitality',
  intellect: 'Intellect',
};

// Quality tiers. `mult` scales base stats/value; `affixes` = number of magical
// powers rolled onto the item.
export const RARITIES = {
  common: { name: 'Common', color: '#c9c9c9', mult: 1.0, affixes: 0 },
  uncommon: { name: 'Uncommon', color: '#4fd14f', mult: 1.3, affixes: 1 },
  rare: { name: 'Rare', color: '#3f8bff', mult: 1.7, affixes: 2 },
  epic: { name: 'Epic', color: '#b45cff', mult: 2.2, affixes: 3 },
  legendary: { name: 'Legendary', color: '#ff9d33', mult: 2.9, affixes: 4 },
};

// Base item definitions.
const BASES = {
  ironsword: { name: 'Iron Sword', icon: '⚔️', category: 'weapon', slot: 'mainHand', weight: 3.5, damage: 8, value: 20 },
  greatsword: { name: 'Greatsword', icon: '🗡️', category: 'weapon', slot: 'mainHand', weight: 6.0, damage: 14, value: 40 },
  shortbow: { name: 'Short Bow', icon: '🏹', category: 'weapon', slot: 'mainHand', weight: 2.0, damage: 6, value: 18 },
  woodshield: { name: 'Wooden Shield', icon: '🛡️', category: 'shield', slot: 'offHand', weight: 4.0, armor: 6, value: 15 },
  ironhelm: { name: 'Iron Helm', icon: '⛑️', category: 'armor', slot: 'head', weight: 2.5, armor: 5, value: 16 },
  ironplate: { name: 'Iron Chestplate', icon: '🦺', category: 'armor', slot: 'chest', weight: 8.0, armor: 12, value: 35 },
  leathergloves: { name: 'Leather Gloves', icon: '🧤', category: 'armor', slot: 'hands', weight: 1.0, armor: 2, value: 8 },
  leatherbelt: { name: 'Leather Belt', icon: '🎗️', category: 'armor', slot: 'waist', weight: 0.8, armor: 1, value: 6 },
  leatherboots: { name: 'Leather Boots', icon: '🥾', category: 'armor', slot: 'feet', weight: 1.5, armor: 3, value: 10 },
  apple: { name: 'Apple', icon: '🍎', category: 'consumable', weight: 0.2, value: 2, stackable: true, use: { health: 10 } },
  bread: { name: 'Bread', icon: '🍞', category: 'consumable', weight: 0.4, value: 3, stackable: true, use: { health: 20 } },
  potion: { name: 'Healing Potion', icon: '🧪', category: 'consumable', weight: 0.3, value: 15, stackable: true, use: { health: 50 } },
  coins: { name: 'Gold Coins', icon: '🪙', category: 'misc', weight: 0.01, value: 1, stackable: true },
};

// Magical affixes. `kind` says where the effect applies; `base` is the raw
// magnitude before rarity/level scaling. `pos` = name position (prefix/suffix).
const AFFIXES = [
  { label: 'Flaming', pos: 'pre', kind: 'stat', key: 'damage', base: 3 },
  { label: 'Keen', pos: 'pre', kind: 'stat', key: 'damage', base: 2 },
  { label: 'Brutal', pos: 'pre', kind: 'stat', key: 'damage', base: 4 },
  { label: 'Sturdy', pos: 'pre', kind: 'stat', key: 'armor', base: 3 },
  { label: 'Reinforced', pos: 'pre', kind: 'stat', key: 'armor', base: 4 },
  { label: 'Warm', pos: 'pre', kind: 'resist', key: 'fire', base: 5 },
  { label: 'of the Titan', pos: 'suf', kind: 'attr', key: 'strength', base: 2 },
  { label: 'of the Fox', pos: 'suf', kind: 'attr', key: 'dexterity', base: 2 },
  { label: 'of the Bear', pos: 'suf', kind: 'attr', key: 'vitality', base: 3 },
  { label: 'of the Owl', pos: 'suf', kind: 'attr', key: 'intellect', base: 2 },
  { label: 'of Warding', pos: 'suf', kind: 'stat', key: 'armor', base: 3 },
  { label: 'of Swiftness', pos: 'suf', kind: 'attr', key: 'dexterity', base: 3 },
];

const PRETTY = {
  damage: 'Damage',
  armor: 'Armor',
  fire: 'Fire Resist',
  cold: 'Cold Resist',
  poison: 'Poison Resist',
  ...ATTR_LABELS,
};
export function prettyKey(k) {
  return PRETTY[k] || k;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let UID = 1;

/**
 * Roll a concrete item instance.
 * @param {string} baseId  key in BASES
 * @param {{rarity?:string, itemLevel?:number, seed?:number, qty?:number}} opts
 */
export function makeItem(baseId, { rarity = 'common', itemLevel = 1, seed = 1, qty = 1 } = {}) {
  const base = BASES[baseId];
  if (!base) throw new Error(`Unknown item base: ${baseId}`);
  const R = RARITIES[rarity];
  const rnd = mulberry32(seed + baseId.length * 131);
  const scale = R.mult * (1 + (itemLevel - 1) * 0.12);
  const roundUp = (v) => Math.max(1, Math.round(v * scale));

  const stats = {};
  if (base.damage) stats.damage = roundUp(base.damage);
  if (base.armor) stats.armor = roundUp(base.armor);

  const attributes = {};
  const resist = {};
  const magic = [];

  // Roll N distinct affixes for the rarity.
  const pool = AFFIXES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = base.category === 'consumable' || base.category === 'misc' ? [] : pool.slice(0, R.affixes);

  let namePre = null;
  let nameSuf = null;
  for (const a of chosen) {
    const val = Math.max(1, Math.round(a.base * scale));
    if (a.kind === 'stat') stats[a.key] = (stats[a.key] || 0) + val;
    else if (a.kind === 'attr') attributes[a.key] = (attributes[a.key] || 0) + val;
    else if (a.kind === 'resist') resist[a.key] = (resist[a.key] || 0) + val;
    magic.push(`+${val} ${prettyKey(a.key)}`);
    if (a.pos === 'pre' && !namePre) namePre = a.label;
    else if (a.pos === 'suf' && !nameSuf) nameSuf = a.label;
  }

  const name = [namePre, base.name, nameSuf].filter(Boolean).join(' ');
  const value = Math.round((base.value || 1) * scale + magic.length * 12);

  return {
    uid: UID++,
    baseId,
    name,
    icon: base.icon,
    category: base.category,
    slot: base.slot || null,
    rarity,
    itemLevel,
    weight: base.weight,
    value,
    stats,
    attributes,
    resist,
    magic,
    stackable: !!base.stackable,
    qty,
    use: base.use || null,
  };
}

export function coins(amount) {
  return makeItem('coins', { qty: amount });
}
export function stack(baseId, qty) {
  return makeItem(baseId, { qty });
}

// A curated chest hoard spanning slots and rarities (stable between reloads).
export function defaultChestLoot() {
  return [
    makeItem('ironsword', { rarity: 'uncommon', itemLevel: 3, seed: 11 }),
    makeItem('woodshield', { rarity: 'rare', itemLevel: 4, seed: 22 }),
    makeItem('ironhelm', { rarity: 'common', itemLevel: 2, seed: 33 }),
    makeItem('ironplate', { rarity: 'epic', itemLevel: 6, seed: 44 }),
    makeItem('leathergloves', { rarity: 'uncommon', itemLevel: 2, seed: 55 }),
    makeItem('leatherbelt', { rarity: 'rare', itemLevel: 3, seed: 66 }),
    makeItem('leatherboots', { rarity: 'legendary', itemLevel: 5, seed: 77 }),
    makeItem('shortbow', { rarity: 'rare', itemLevel: 4, seed: 88 }),
    makeItem('greatsword', { rarity: 'epic', itemLevel: 7, seed: 99 }),
    coins(120),
    stack('apple', 3),
    stack('bread', 2),
    stack('potion', 2),
  ];
}

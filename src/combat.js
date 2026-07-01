/**
 * Turn-based combat with a scrolling action log.
 *
 * `start(enemy, { onEnd })` opens the combat panel. The player chooses an
 * action each turn (Attack / Defend / Eat / Flee); the enemy retaliates. Player
 * stats (damage, armor, health, food) come from the inventory, so equipping a
 * sword and armour genuinely matters. Ends with onEnd({ result }).
 */
export function createCombat({ inventory }) {
  const app = document.getElementById('app');

  const panel = document.createElement('div');
  panel.id = 'combat';
  panel.innerHTML = `
    <div class="cbt-top">
      <div class="cbt-enemy">
        <div class="cbt-enemy-name"></div>
        <div class="bar big"><div class="bar-fill enemy"></div></div>
      </div>
    </div>
    <div class="cbt-log"></div>
    <div class="cbt-bottom">
      <div class="cbt-player">
        <span>You</span>
        <div class="bar big"><div class="bar-fill hp"></div></div>
        <b class="cbt-php"></b>
      </div>
      <div class="cbt-actions">
        <button data-act="attack">⚔️ Attack</button>
        <button data-act="defend">🛡️ Defend</button>
        <button data-act="eat">🍖 Eat</button>
        <button data-act="flee">🏃 Flee</button>
      </div>
    </div>`;
  app.appendChild(panel);
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  const enemyName = panel.querySelector('.cbt-enemy-name');
  const enemyBar = panel.querySelector('.bar-fill.enemy');
  const logEl = panel.querySelector('.cbt-log');
  const hpBar = panel.querySelector('.bar-fill.hp');
  const phpEl = panel.querySelector('.cbt-php');
  const buttons = [...panel.querySelectorAll('.cbt-actions button')];

  let enemy = null;
  let onEnd = null;
  let busy = false;
  let defending = false;

  const rand = () => Math.random();
  const vary = (base) => Math.max(1, Math.round(base * (0.8 + rand() * 0.4)));

  function log(msg, cls = '') {
    const line = document.createElement('div');
    line.className = `cbt-line ${cls}`;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderBars() {
    enemyBar.style.width = `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`;
    const hp = inventory.getHealth();
    const max = inventory.getMaxHealth();
    hpBar.style.width = `${Math.max(0, (hp / max) * 100)}%`;
    phpEl.textContent = `${Math.round(hp)}/${max}`;
  }

  function setButtons(on) {
    buttons.forEach((b) => (b.disabled = !on));
  }

  function finish(result) {
    setButtons(false);
    panel.classList.remove('show');
    const cb = onEnd;
    onEnd = null;
    enemy = null;
    if (cb) cb({ result });
  }

  function enemyTurn() {
    if (!enemy) return;
    let dmg = vary(enemy.damage);
    const armor = inventory.getArmor();
    dmg = Math.max(1, dmg - Math.floor(armor / 3));
    if (defending) dmg = Math.max(1, Math.round(dmg * 0.4));
    inventory.damagePlayer(dmg);
    log(`${enemy.name} mauls you for ${dmg}.`, 'bad');
    defending = false;
    renderBars();
    if (inventory.isDead()) {
      log('Your vision fades to black…', 'bad');
      setTimeout(() => finish('defeat'), 1000);
      return;
    }
    busy = false;
    setButtons(true);
  }

  function afterPlayerAction() {
    renderBars();
    if (enemy.health <= 0) {
      log(`${enemy.name} lets out a final roar and collapses! You are victorious!`, 'good');
      setTimeout(() => finish('victory'), 1100);
      return;
    }
    setTimeout(() => {
      if (enemy) enemy.onAttack?.();
      enemyTurn();
    }, 850);
  }

  const actions = {
    attack() {
      const dmg = vary(inventory.getDamage());
      enemy.health -= dmg;
      const w = inventory.weaponName();
      log(w ? `You swing your ${w} and hit ${enemy.name} for ${dmg}.` : `You punch ${enemy.name} for a feeble ${dmg}.`, 'good');
      afterPlayerAction();
    },
    defend() {
      defending = true;
      log('You raise your guard, bracing for the blow.', 'info');
      afterPlayerAction();
    },
    eat() {
      const r = inventory.useBestFood();
      if (!r) {
        log('You have no food to eat!', 'warn');
        busy = false;
        setButtons(true);
        return;
      }
      log(`You wolf down ${r.name}, recovering ${r.healed} HP.`, 'good');
      afterPlayerAction();
    },
    flee() {
      if (rand() < 0.5) {
        log('You break away and scramble for the cave mouth!', 'info');
        setTimeout(() => finish('flee'), 800);
      } else {
        log(`${enemy.name} blocks your escape!`, 'warn');
        afterPlayerAction();
      }
    },
  };

  for (const b of buttons) {
    b.addEventListener('click', () => {
      if (busy || !enemy) return;
      busy = true;
      setButtons(false);
      actions[b.dataset.act]();
    });
  }

  function start(e, { onEnd: cb } = {}) {
    enemy = { ...e, maxHealth: e.health };
    onEnd = cb;
    busy = false;
    defending = false;
    logEl.innerHTML = '';
    enemyName.textContent = `${e.icon || '🐻'} ${e.name}`;
    panel.classList.add('show');
    renderBars();
    log(e.intro || `${e.name} rears up with a deafening roar!`, 'bad');
    if (!inventory.hasWeapon()) log('You have no weapon equipped — arm yourself or flee!', 'warn');
    setButtons(true);
  }

  return {
    start,
    get active() {
      return panel.classList.contains('show');
    },
  };
}

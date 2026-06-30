/**
 * Minimal dialogue panel. `open(speaker, lines)` shows the first line; clicking
 * the panel (or the slow auto-advance) steps through the rest. `close()` hides
 * it. Clicks on the panel are kept from reaching the canvas so they don't also
 * move the player.
 */
export function createDialogue() {
  const panel = document.createElement('div');
  panel.id = 'dialogue';
  panel.innerHTML = `
    <div class="dlg-name"></div>
    <div class="dlg-text"></div>
    <div class="dlg-hint">click to continue ▸</div>
  `;
  document.getElementById('app').appendChild(panel);

  const nameEl = panel.querySelector('.dlg-name');
  const textEl = panel.querySelector('.dlg-text');
  const hintEl = panel.querySelector('.dlg-hint');

  let lines = [];
  let idx = 0;
  let active = false;
  let speaker = '';
  let autoTimer = 0;

  function render() {
    nameEl.textContent = speaker;
    textEl.textContent = lines[idx] || '';
    hintEl.style.visibility = idx < lines.length - 1 ? 'visible' : 'hidden';
  }

  function next() {
    if (idx < lines.length - 1) {
      idx++;
      autoTimer = 0;
      render();
    }
  }

  function open(who, ls) {
    if (active && who === speaker) return; // already talking to them
    speaker = who;
    lines = ls;
    idx = 0;
    active = true;
    autoTimer = 0;
    render();
    panel.classList.add('show');
  }

  function close() {
    if (!active) return;
    active = false;
    panel.classList.remove('show');
  }

  panel.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    next();
  });

  return {
    open,
    close,
    get active() {
      return active;
    },
    tick(delta) {
      if (!active) return;
      autoTimer += delta;
      if (autoTimer > 5) {
        autoTimer = 0;
        next();
      }
    },
  };
}

/**
 * Branching dialogue panel. `open(speaker, tree, startId)` shows a node's text
 * and a list of clickable options (answers / questions). Each option either
 * jumps to another node (`next`) or ends the conversation (`next: null`), and
 * may run a side-effect (`action`). Clicks on the panel/options are kept from
 * reaching the canvas so they don't also move the player.
 *
 * A dialogue tree is a map of node id -> { text, options: [{ label, next, action? }] }.
 */
export function createDialogue() {
  const panel = document.createElement('div');
  panel.id = 'dialogue';
  panel.innerHTML = `
    <div class="dlg-name"></div>
    <div class="dlg-text"></div>
    <div class="dlg-options"></div>
  `;
  document.getElementById('app').appendChild(panel);
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  const nameEl = panel.querySelector('.dlg-name');
  const textEl = panel.querySelector('.dlg-text');
  const optsEl = panel.querySelector('.dlg-options');

  let tree = null;
  let node = null;
  let speaker = '';
  let active = false;

  function render() {
    nameEl.textContent = speaker;
    textEl.textContent = node.text;
    optsEl.innerHTML = '';
    node.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'dlg-option';
      btn.textContent = opt.label;
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        choose(opt);
      });
      optsEl.appendChild(btn);
    });
  }

  function choose(opt) {
    if (opt.action) opt.action();
    if (opt.next == null || !tree[opt.next]) {
      close();
    } else {
      node = tree[opt.next];
      render();
    }
  }

  function open(who, dialogueTree, startId = 'start') {
    speaker = who;
    tree = dialogueTree;
    node = tree[startId];
    active = true;
    render();
    panel.classList.add('show');
  }

  function close() {
    if (!active) return;
    active = false;
    panel.classList.remove('show');
  }

  return {
    open,
    close,
    get active() {
      return active;
    },
  };
}

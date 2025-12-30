/* =========================================================
   GLOBAL STATE
   ========================================================= */
let pokemonList = [];
let state = {};
let currentVersion = 'Red';
let collapsedSections = new Set();
let userExpandedSections = new Set();
let autoCollapsedSections = new Set();
let isInitialLoad = true;
let appPhase = 'loading'; // 'loading' | 'rendering' | 'active'

const sectionCompletion = { STARTER: false };
const completedObjectives = new Set();

const STORAGE_KEY = 'oak-challenge-v1';

/* =========================================================
   POKÉMON CRY SYSTEM
   ========================================================= */

const CRY_BASE_URL =
  'https://raw.githubusercontent.com/FerdigVibes/Gen_1-5_Animated_Sprites/main/';

let activeCry = null;

let criesMuted = false;

// Load saved preference
try {
  criesMuted = localStorage.getItem('criesMuted') === 'true';
} catch {}

function playPokemonCry(dexNumber) {
  if (!dexNumber || criesMuted) return;

  // Stop any currently playing cry
  if (activeCry) {
    activeCry.pause();
    activeCry.currentTime = 0;
  }

  const audio = new Audio(`${CRY_BASE_URL}${dexNumber}.ogg`);
  audio.volume = 0.6;

  audio.play().catch(err => {
    // Mobile Safari requires user interaction — this is expected
    console.warn('Cry playback blocked:', err);
  });

  activeCry = audio;
}

function wireMuteButton() {
  const btn = document.getElementById('mute-cries');
  if (!btn) return;

  const updateIcon = () => {
    btn.textContent = criesMuted ? '🔇' : '🔊';
  };

  updateIcon();

  btn.addEventListener('click', () => {
    criesMuted = !criesMuted;

    // Stop any current sound immediately
    if (criesMuted && activeCry) {
      activeCry.pause();
      activeCry.currentTime = 0;
    }

    try {
      localStorage.setItem('criesMuted', String(criesMuted));
    } catch {}

    updateIcon();
  });
}

function loadAllProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAllProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgressForVersion(version) {
  const all = loadAllProgress();
  return all[version] || {};
}

function saveProgressForVersion(version, state) {
  const all = loadAllProgress();
  all[version] = state;
  saveAllProgress(all);
}

function clearProgressForVersion(version) {
  const all = loadAllProgress();
  delete all[version];
  saveAllProgress(all);
}

function clearAllProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

/* =========================================================
   RESET OPTIONS
   ========================================================= */
const RESET_OPTIONS = {
  Red: [
    { key: 'STARTER', label: 'Choose Your Starter!' },
    { key: 'PEWTER', label: 'Pewter Pokémon' },
    { key: 'CERULEAN', label: 'Cerulean Pokémon' },
    { key: 'MOON STONE 1', label: 'Choose Two Moon Stone Evolutions' },
    { key: 'FUCHSIA', label: 'Fuchsia Pokémon' },
    { key: 'MOON STONE 2', label: 'Remaining Moon Stone Evolutions' },
    { key: 'EEVEE', label: 'Choose Your Eevee Evolution' },
    { key: 'DOJO', label: 'Choose One Fighting Dojo Prize' },
    { key: 'CELADON', label: 'Celadon Pokémon' },
    { key: 'FOSSIL', label: 'Revive One Fossil Line' },
    { key: 'ARTICUNO', label: 'Articuno' },
    { key: 'MOLTRES', label: 'Moltres' },
    { key: 'CERULEAN CAVE', label: 'Cerulean Cave pokemon' },
  ],
  Blue: null,
  Yellow: [
    { key: 'STARTER', label: 'I Choose You, Pikachu!' },
    { key: 'PEWTER', label: 'Pewter Pokémon' },
    { key: 'CERULEAN', label: 'Cerulean Pokémon' },
    { key: 'MOON STONE 1', label: 'Choose Two Moon Stone Evolutions' },
    { key: 'FUCHSIA', label: 'Fuchsia Pokémon' },
    { key: 'MOON STONE 2', label: 'Remaining Moon Stone Evolutions' },
    { key: 'EEVEE', label: 'Choose Your Eevee Evolution' },
    { key: 'DOJO', label: 'Choose One Fighting Dojo Prize' },
    { key: 'CELADON', label: 'Celadon Pokémon' },
    { key: 'FOSSIL', label: 'Revive One Fossil Line' },
    { key: 'SQUIRTLE', label: 'Get Squirtle' },
    { key: 'ARTICUNO', label: 'Articuno' },
    { key: 'MOLTRES', label: 'Moltres' },
    { key: 'CERULEAN CAVE', label: 'Cerulean Cave' },
  ]
};
RESET_OPTIONS.Blue = RESET_OPTIONS.Red;

/* =========================================================
   SECTION LAYOUTS
   ========================================================= */
const SECTION_LAYOUTS = {
  RedBlue: {
    STARTER:{range:[6,23],required:3},
    PEWTER:{range:[25,60],required:18},
    CERULEAN:{range:[63,110],required:24},
    'MOON STONE 1':{range:[112,119],required:2},
    FUCHSIA:{range:[122,229],required:54},
    'MOON STONE 2':{range:[231,238],required:2},
    EEVEE:{range:[240,245],required:1},
    DOJO:{range:[247,250],required:1},
    CELADON:{range:[253,280],required:14},
    FOSSIL:{range:[282,289],required:2},
    ARTICUNO:{range:[292,293],required:1},
    MOLTRES:{range:[296,297],required:1},
    'CERULEAN CAVE':{range:[300,301],required:1}
  },
  Yellow: {
    STARTER:{range:[6,7],required:1},
    PEWTER:{range:[9,40],required:16},
    CERULEAN:{range:[43,104],required:31},
    'MOON STONE 1':{range:[106,113],required:2},
    FUCHSIA:{range:[116,217],required:51},
    'MOON STONE 2':{range:[219,226],required:2},
    EEVEE:{range:[228,233],required:1},
    DOJO:{range:[235,238],required:1},
    CELADON:{range:[241,270],required:15},
    FOSSIL:{range:[272,279],required:2},
    SQUIRTLE:{range:[282,287],required:3},
    ARTICUNO:{range:[290,291],required:1},
    MOLTRES:{range:[294,295],required:1},
    'CERULEAN CAVE':{range:[298,301],required:2}
  }
};

const OBJECTIVE_THRESHOLDS = {
  Red: [
    { limit: 21,  label: 'BEFORE PEWTER GYM' },
    { limit: 47,  label: 'BEFORE CERULEAN GYM' },
    { limit: 105, label: 'BEFORE FUCHSIA GYM' },
    { limit: 121, label: 'BEFORE CELADON GYM' },
    { limit: 122, label: 'BEFORE BADGES 5–8' },
    { limit: 123, label: 'BEFORE ELITE FOUR' },
    { limit: 124, label: 'CERULEAN CAVE' }
  ],

  Blue: [
    { limit: 21,  label: 'BEFORE PEWTER GYM' },
    { limit: 47,  label: 'BEFORE CERULEAN GYM' },
    { limit: 105, label: 'BEFORE FUCHSIA GYM' },
    { limit: 121, label: 'BEFORE CELADON GYM' },
    { limit: 122, label: 'BEFORE BADGES 5–8' },
    { limit: 123, label: 'BEFORE ELITE FOUR' },
    { limit: 124, label: 'CERULEAN CAVE' }
  ],

  Yellow: [
    { limit: 17,  label: 'BEFORE PEWTER GYM' },
    { limit: 50,  label: 'BEFORE CERULEAN GYM' },
    { limit: 105, label: 'BEFORE FUCHSIA GYM' },
    { limit: 122, label: 'BEFORE CELADON GYM' },
    { limit: 125, label: 'ONLY AVAILABLE AFTER VERMILION GYM BADGE' },
    { limit: 126, label: 'BEFORE BADGES 5–8' },
    { limit: 127, label: 'BEFORE ELITE FOUR' },
    { limit: 129, label: 'CERULEAN CAVE' }
  ]
};

const OBJECTIVE_COMPLETIONS = {
  Red: {
    21: 'PEWTER COMPLETE!',
    47: 'CERULEAN COMPLETE!',
    105: 'FUCHSIA COMPLETE!',
    121: 'CELADON COMPLETE!',
    122: 'ARTICUNO CAUGHT!',
    123: 'MOLRES CLAIMED!',
    124: 'CHALLENGE COMPLETE!!'
  },
  Blue: {
    21: 'PEWTER COMPLETE!',
    47: 'CERULEAN COMPLETE!',
    105: 'FUCHSIA COMPLETE!',
    121: 'CELADON COMPLETE!',
    122: 'ARTICUNO CAUGHT!',
    123: 'MOLRES CLAIMED!',
    124: 'CHALLENGE COMPLETE!!'
  },
  Yellow: {
    17: 'PEWTER COMPLETE!',
    50: 'CERULEAN COMPLETE!',
    105: 'FUCHSIA COMPLETE!',
    122: 'CELADON COMPLETE!',
    125: 'SQUIRTLE SQUAD DONE!',
    126: 'ARTICUNO CAUGHT!',
    127: 'MOLTRES CLAIMED!',
    129: 'CHALLENGE COMPLETE!!!'
  }
};

const STORAGE_KEY_PREFIX = 'oak-challenge';

function loadStateForVersion(version) {
  const key = `${STORAGE_KEY_PREFIX}:${version}`;
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}

function getRowsForFamilyInRange(familyNames, startRow, endRow) {
  const normalized = familyNames.map(normalizeName);

  return pokemonList
    .filter(p =>
      p.type === 'pokemon' &&
      p.row >= startRow &&
      p.row <= endRow &&
      normalized.includes(normalizeName(p.name))
    )
    .map(p => p.row);
}

function saveStateForVersion(version, newState) {
  const key = `${STORAGE_KEY_PREFIX}:${version}`;
  localStorage.setItem(key, JSON.stringify(newState));
}

function applyStarterExclusivity() {
  // Only applies to Red / Blue
  if (currentVersion !== 'Red' && currentVersion !== 'Blue') return;

  const cfg = getLayout().STARTER;
  if (!cfg) return;

  const [startRow, endRow] = cfg.range;

  const families = [
    ['Bulbasaur', 'Ivysaur', 'Venusaur'],
    ['Charmander', 'Charmeleon', 'Charizard'],
    ['Squirtle', 'Wartortle', 'Blastoise']
  ].map(family =>
    getRowsForFamilyInRange(family, startRow, endRow)
  );

  // Determine which family (if any) is chosen
  const chosenFamilyIndex = families.findIndex(rows =>
    rows.some(r => state[r] === true)
  );

  // No starter chosen yet → show everything
  if (chosenFamilyIndex === -1) return;

  // Hide ALL other families
  families.forEach((rows, index) => {
    if (index === chosenFamilyIndex) return;
    rows.forEach(hideRow);
  });
}

const getLayout = () =>
  currentVersion === 'Yellow'
    ? SECTION_LAYOUTS.Yellow
    : SECTION_LAYOUTS.RedBlue;

const SECTION_UNLOCK_RULES = {
  'MOON STONE 1': () => {
    if (currentVersion === 'Yellow') return true; // count-based handles it
    const cfg = SECTION_LAYOUTS.RedBlue.PEWTER;
    return isAnyChecked(cfg.range[0], cfg.range[1]);
  },

  'MOON STONE 2': () => {
    if (currentVersion === 'Yellow') return true;
    const cfg = SECTION_LAYOUTS.RedBlue.CELADON;
    return isAnyChecked(cfg.range[0], cfg.range[1]);
  },

  'FOSSIL': () => {
    if (currentVersion === 'Yellow') return true;
    const cfg = SECTION_LAYOUTS.RedBlue['MOON STONE 1'];
    return isAnyChecked(cfg.range[0], cfg.range[1]);
  }
};

const EXCLUSIVE_GROUPS = [
  {
    section: 'FOSSIL',
    families: [
      ['Omanyte', 'Omastar'],
      ['Kabuto', 'Kabutops']
    ]
  }
];

const SECTION_HEADER_TITLES = {
  STARTER: {
    Red: 'Choose Your Starter!',
    Blue: 'Choose Your Starter!',
    Yellow: 'I CHOOSE YOU, PIKACHU!!!'
  },

  PEWTER: {
    Red: 'Pewter Pokemon',
    Blue: 'Pewter Pokemon',
    Yellow: 'Pewter Pokemon'
  },

  CERULEAN: {
    Red: 'Cerulean Pokemon',
    Blue: 'Cerulean Pokemon',
    Yellow: 'Cerulean Pokemon'
  },

  'MOON STONE 1': {
    Red: 'Choose Two Moon Stone Evolutions',
    Blue: 'Choose Two Moon Stone Evolutions',
    Yellow: 'Choose Two Moon Stone Evolutions'
  },

  FUCHSIA: {
    Red: 'Fuchsia Pokemon',
    Blue: 'Fuchsia Pokemon',
    Yellow: 'Fuchsia Pokemon'
  },

  'MOON STONE 2': {
    Red: 'Remaining Two Moon Stone Evolutions',
    Blue: 'Remaining Two Moon Stone Evolutions',
    Yellow: 'Remaining Two Moon Stone Evolutions'
  },

  EEVEE: {
    Red: 'Choose Your Eevee Evolution',
    Blue: 'Choose Your Eevee Evolution',
    Yellow: 'Choose Your Eevee Evolution'
  },

  DOJO: {
    Red: 'Choose One Fighting Dojo Prize',
    Blue: 'Choose One Fighting Dojo Prize',
    Yellow: 'Choose One Fighting Dojo Prize'
  },

  CELADON: {
    Red: 'Celadon Pokemon',
    Blue: 'Celadon Pokemon',
    Yellow: 'Celadon Pokemon'
  },

  FOSSIL: {
    Red: 'Revive One Fossil Line',
    Blue: 'Revive One Fossil Line',
    Yellow: 'Revive One Fossil Line'
  },

  SQUIRTLE: {
    Yellow: 'Squirtle Line'
  },

  ARTICUNO: {
    Red: 'Articuno',
    Blue: 'Articuno',
    Yellow: 'Articuno'
  },

  MOLTRES: {
    Red: 'Moltres',
    Blue: 'Moltres',
    Yellow: 'Moltres'
  },

  'CERULEAN CAVE': {
    Red: 'Cerulean Cave Pokemon',
    Blue: 'Cerulean Cave Pokemon',
    Yellow: 'Cerulean Cave Pokemon'
  },
};

const FINAL_MOONSTONE_EVOS = [
  'Nidoking',
  'Nidoqueen',
  'Clefable',
  'Wigglytuff'
];

const STARTER_EXCLUSIVE_GROUP = {
  section: 'STARTER',
  versions: ['Red', 'Blue'],
  families: [
    ['Bulbasaur', 'Ivysaur', 'Venusaur'],
    ['Charmander', 'Charmeleon', 'Charizard'],
    ['Squirtle', 'Wartortle', 'Blastoise']
  ]
};

/* =========================================================
   HELPERS
   ========================================================= */
const hideRow = r => {
  const el = document.querySelector(`.row[data-row="${r}"]`);
  if (el) el.classList.add('hidden');
};

const isAnyChecked = (s,e) => {
  for (let r=s;r<=e;r++) if (state[r]) return true;
  return false;
};

const getRowsUnderHeader = hr => {
  const rows=[];
  for (let i=0;i<pokemonList.length;i++){
    if(pokemonList[i].type==='header'&&pokemonList[i].row===hr){
      for(let j=i+1;j<pokemonList.length;j++){
        if(pokemonList[j].type==='header') break;
        if(pokemonList[j].type==='pokemon') rows.push(pokemonList[j].row);
      }
      break;
    }
  }
  return rows;
};

function setRegistered(rowEl, isRegistered) {
  if (!rowEl) return;
  rowEl.classList.toggle('registered', !!isRegistered);
}

function syncTopBarOffset() {
  const topBar = document.querySelector('.top-bar');
  if (!topBar) return;

  const height = topBar.getBoundingClientRect().height;
  document.documentElement.style.setProperty(
    '--top-bar-offset',
    `${height}px`
  );
}

function normalizeName(str) {
  return String(str)
    .toLowerCase()
    .replace(/\.(gif|png|jpg|jpeg)$/i, '')
    .replace(/#[0-9]+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getResetLabelForKey(sectionKey) {
  const opts = RESET_OPTIONS[currentVersion] || [];
  const hit = opts.find(o => o.key === sectionKey);
  return hit ? hit.label : sectionKey;
}

function getHeaderBySectionName(sectionKey) {
  const titles = SECTION_HEADER_TITLES[sectionKey];
  if (!titles) return null;

  const title = titles[currentVersion];
  if (!title) return null;

  return pokemonList.find(
    i => i.type === 'header' && i.title === title
  );
}

function resetSectionByKey(sectionKey) {
  const layout = getLayout();
  const cfg = layout[sectionKey];
  if (!cfg) return;

  const [start, end] = cfg.range;

  for (let r = start; r <= end; r++) {
    state[r] = false;

    const rowEl = document.querySelector(`.row[data-row="${r}"]`);
    if (rowEl) {
      rowEl.classList.remove('registered');

      const cb = rowEl.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
    }
  }

  // 🔥 CRITICAL FIX
  const header = getHeaderBySectionName(sectionKey);
  if (header) {
    collapsedSections.delete(header.row);
    autoCollapsedSections.delete(header.row);
    userExpandedSections.delete(header.row);
  }

  saveProgressForVersion(currentVersion, state);
  refreshUI();
}

function getHeaderRowByTitle(title) {
  const h = pokemonList.find(
    i => i.type === 'header' && i.title === title
  );
  return h ? h.row : null;
}

function getRowsForFamilyInSection(familyNames, sectionTitle) {
  const headerRow = getHeaderRowByTitle(sectionTitle);
  if (!headerRow) return [];

  const sectionRows = new Set(getRowsUnderHeader(headerRow)); // rows in this section only
  const normalized = familyNames.map(normalizeName);

  return pokemonList
    .filter(i =>
      i.type === 'pokemon' &&
      sectionRows.has(i.row) &&
      normalized.includes(normalizeName(i.name))
    )
    .map(i => i.row);
}

function isFamilyChosen(rows) {
  return rows.some(r => state[r]);
}

function applyFinalEvolutionHiding() {
  const finals = FINAL_MOONSTONE_EVOS.map(normalizeName);

  // Group rows by normalized Pokémon name
  const groups = {};

  pokemonList.forEach(i => {
    if (
      i.type === 'pokemon' &&
      finals.includes(normalizeName(i.name))
    ) {
      const key = normalizeName(i.name);
      if (!groups[key]) groups[key] = [];
      groups[key].push(i.row);
    }
  });

  // For each group, if one is checked, hide the unchecked duplicates
  Object.values(groups).forEach(rows => {
    const checkedRow = rows.find(r => state[r] === true);
    if (!checkedRow) return;

    rows.forEach(r => {
      if (r !== checkedRow) {
        hideRow(r);
      }
    });
  });
}

function applyStarterExclusivity() {
  // Only applies to Red / Blue
  if (currentVersion !== 'Red' && currentVersion !== 'Blue') return;

  const cfg = getLayout().STARTER; // uses SECTION_LAYOUTS
  const [startRow, endRow] = cfg.range;

  const families = STARTER_EXCLUSIVE_GROUP.families.map(f =>
    getRowsForFamilyInRange(f, startRow, endRow)
  );

  const chosenIndex = families.findIndex(isFamilyChosen);
  if (chosenIndex === -1) return;

  families.forEach((rows, idx) => {
    if (idx === chosenIndex) return;
    rows.forEach(hideRow);
  });
}

function updateCurrentObjective() {
  const container = document.getElementById('current-objective');
  const textEl = document.getElementById('objective-text');
  if (!container || !textEl) return;

  const totalCaught = pokemonList
    .filter(i => i.type === 'pokemon' && state[i.row] === true)
    .length;

  const rules = OBJECTIVE_THRESHOLDS[currentVersion];
  if (!rules) return;

  let newLabel = 'ALL OBJECTIVES COMPLETE';

  for (const rule of rules) {
    if (totalCaught < rule.limit) {
      newLabel = rule.label;
      break;
    }
  }

  // 🔁 Do nothing if text did not change
  if (textEl.textContent === newLabel) return;

  // Animate out
  textEl.classList.add('swap');

  // After fade-out, swap text and animate in
  setTimeout(() => {
    textEl.textContent = newLabel;
    textEl.classList.remove('swap');
  }, 180);
}

function getRowsForFamilyInRange(familyNames, startRow, endRow) {
  const normalized = familyNames.map(normalizeName);

  return pokemonList
    .filter(i =>
      i.type === 'pokemon' &&
      i.row >= startRow &&
      i.row <= endRow &&
      normalized.includes(normalizeName(i.name))
    )
    .map(i => i.row);
}

/* =========================================================
   DATA LOADING & RENDERING
   ========================================================= */
async function loadPokemonData() {
  appPhase = 'loading';
  showLoading();

  try {
    const res = await fetch(`data/gen1/${currentVersion.toLowerCase()}.json`);
    const json = await res.json();

    pokemonList = [];
    state = {};

    let virtualRow = 1;

    json.sections.forEach(section => {
      // Header
      pokemonList.push({
        type: 'header',
        row: virtualRow++,
        title: section.title,
        key: section.key,
        headerLevel: 'major'
      });

      section.pokemon.forEach(p => {
        pokemonList.push({
          type: 'pokemon',
          row: virtualRow++,
          dex: p.dex,
          name: p.name,
          info: p.info || '',
          notes: p.notes || '',
          image: p.image,
          id: p.id
        });
      });
    });

    const saved = loadProgressForVersion(currentVersion);
    pokemonList.forEach(i => {
      if (i.type === 'pokemon') {
        state[i.row] = saved[i.row] ?? false;
      }
    });

    renderRows();
    appPhase = 'active';
    refreshUI();
  } catch (err) {
    console.error('Failed to load JSON:', err);
  } finally {
    hideLoading();
  }
}

function renderRows() {
  const c = document.getElementById('rows');
  if (!c) return;

  c.innerHTML = '';

  pokemonList.forEach(i => {

    /* ================= HEADER ================= */
    if (i.type === 'header') {
      const h = document.createElement('div');

      const level = i.headerLevel === 'major';
      h.className = `section-header ${level}-header`;
      h.dataset.row = i.row;
      h.textContent = i.title;

      h.onclick = () => {
        const rowId = i.row;

        if (collapsedSections.has(rowId)) {
          collapsedSections.delete(rowId);
          userExpandedSections.add(rowId);
        } else {
          collapsedSections.add(rowId);
          userExpandedSections.delete(rowId);
          autoCollapsedSections.delete(rowId);
        }

        refreshUI();
      };

      c.appendChild(h);
    }

    /* ================= POKÉMON ROW ================= */
    else if (i.type === 'pokemon') {
      const r = document.createElement('div');
      r.className = 'row';
      r.dataset.row = i.row;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state[i.row] === true;
      cb.style.display = 'none';

      const ball = document.createElement('div');
      ball.className = 'pokeball';

      if (cb.checked) {
        r.classList.add('registered');
      }

      /* --- toggle logic --- */
      const toggle = () => {
        const wasChecked = cb.checked;

        cb.checked = !cb.checked;
        state[i.row] = cb.checked;

        saveProgressForVersion(currentVersion, state);
        r.classList.toggle('registered', cb.checked);

        // 🔊 PLAY CRY ONLY WHEN TURNING TRUE
        if (!wasChecked && cb.checked && i.dex) {
          playPokemonCry(i.dex);
        }

        refreshUI();
      };

      r.addEventListener('click', toggle);

      ball.addEventListener('click', e => {
        e.stopPropagation();
        toggle();
      });

      const sprite = document.createElement('div');
      sprite.className = 'sprite-frame';

      const img = document.createElement('img');
      if (i.image) img.src = i.image;
      sprite.appendChild(img);

      const t = document.createElement('div');
      t.className = 'text';
      t.innerHTML = `
        <div class="name">${i.name}</div>
        ${i.info ? `<div class="info">${i.info}</div>` : ''}
        ${i.notes ? `<div class="notes">${i.notes}</div>` : ''}
      `;

      r.append(cb, ball, sprite, t);
      c.appendChild(r);
    }

  });
}

function updateTopBarHeight() {
  const bar = document.querySelector('.top-bar');
  if (bar) {
    document.documentElement.style.setProperty(
      '--top-bar-height',
      `${bar.offsetHeight}px`
    );
  }
}

window.addEventListener('load', updateTopBarHeight);
window.addEventListener('resize', updateTopBarHeight);

function applyFossilExclusivity() {
  const header = getHeaderBySectionName('FOSSIL');
  if (!header) return;

  const omanyteFamily = getRowsForFamilyInSection(
    ['Omanyte', 'Omastar'],
    header.title
  );

  const kabutoFamily = getRowsForFamilyInSection(
    ['Kabuto', 'Kabutops'],
    header.title
  );

  const omanyteChosen = omanyteFamily.some(r => state[r] === true);
  const kabutoChosen  = kabutoFamily.some(r => state[r] === true);

  if (omanyteChosen) kabutoFamily.forEach(hideRow);
  if (kabutoChosen)  omanyteFamily.forEach(hideRow);
}


function refreshUI() {
  // ❌ Do NOTHING unless the app is fully ready
  if (appPhase !== 'active') return;

  try {
    updateProgress();
    applyRules();
    updateCurrentObjective();
  } catch (err) {
    console.error('refreshUI failed:', err);
  }
}

function applyRules() {
  // 1. Reset visibility
  document.querySelectorAll('.row').forEach(r =>
    r.classList.remove('hidden')
  );

  // 2. Exclusivity rules
  applyStarterExclusivity();
  applyFinalEvolutionHiding();
  applyFossilExclusivity();

  // 3. Section collapsing LAST
  collapsedSections.forEach(headerRow => {
    getRowsUnderHeader(headerRow).forEach(hideRow);
  });
}


function updateProgress() {
  isInitialLoad = false;

  const layout = getLayout();

  Object.entries(layout).forEach(([sectionKey, cfg]) => {
    const header = getHeaderBySectionName(sectionKey);
    if (!header) return;

    const caughtInSection = getRowsUnderHeader(header.row)
      .filter(r => state[r] === true).length;

    const isComplete = !isInitialLoad && caughtInSection >= cfg.required;

    // ✅ Only auto-collapse if complete AND user has NOT forced it open
    if (isComplete && !userExpandedSections.has(header.row)) {
      collapsedSections.add(header.row);
      autoCollapsedSections.add(header.row);
    }

    // ✅ If it is NOT complete anymore, remove auto-collapse status
    if (!isComplete) {
      autoCollapsedSections.delete(header.row);
    }
  });

  // ✅ FIXED COUNTER (THIS IS THE IMPORTANT PART)
  const total = currentVersion === 'Yellow' ? 129 : 124;

  const caught = pokemonList
    .filter(i => i.type === 'pokemon' && state[i.row] === true)
    .length;

  const counterEl = document.getElementById('global-counter');
  if (counterEl) {
    counterEl.textContent = `${caught}/${total} Caught`;
  }

  updateProgressBar(caught, total);

  triggerCelebrationIfNeeded(caught);
}

function updateProgressBar(c,t){
  const b=document.getElementById('progress-bar');
  if (!b) return;
  b.style.width=`${Math.min(c/t,1)*100}%`;
}

function rebuildResetDropdown() {
  const select = document.getElementById('reset');
  if (!select) return;

  select.innerHTML = '<option value="">Reset</option>';

  // Reset All
  const resetAll = document.createElement('option');
  resetAll.value = 'RESET_ALL';
  resetAll.textContent = 'Reset All';
  select.appendChild(resetAll);

  const options = RESET_OPTIONS[currentVersion];
  if (!options) return;

  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.key;
    opt.textContent = o.label;
    select.appendChild(opt);
  });
}

function resetAllProgress() {
  // 1️⃣ Clear state
  state = {};

  // 2️⃣ Clear visual rows
  document.querySelectorAll('.row').forEach(row => {
    const r = Number(row.dataset.row);
    state[r] = false;

    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = false;

    row.classList.remove('registered', 'hidden');
  });

  // 3️⃣ Clear collapses
  collapsedSections.clear();
  autoCollapsedSections.clear();
  isInitialLoad = true;

  // 4️⃣ Clear saved state
  saveStateForVersion(currentVersion, state);

  // 5️⃣ Re-evaluate UI
  refreshUI();
}

function wireVersionDropdown() {
  const select = document.getElementById('version');
  if (!select) return;

  select.value = currentVersion;

  select.addEventListener('change', () => {
    showLoading();
    appPhase = 'loading';

    currentVersion = select.value;

    // version theme
    document.body.classList.remove('red', 'blue', 'yellow');
    document.body.classList.add(currentVersion.toLowerCase());

    // reset UI-only state
    collapsedSections.clear();
    autoCollapsedSections.clear();
    isInitialLoad = true;
    completedObjectives.clear();

    rebuildResetDropdown();

    // ✅ SINGLE data load
    loadPokemonData();
  });
}

function wireResetDropdown() {
  const select = document.getElementById('reset');
  if (!select) return;

  select.addEventListener('change', () => {
    const sectionKey = select.value;
    if (!sectionKey) return;

    if (sectionKey === 'RESET_ALL') {
      if (confirm('Reset all progress?')) {
        clearProgressForVersion(currentVersion);

        // 1. Clear state
        state = {};

        // 2. Clear visual state (CRITICAL)
        document.querySelectorAll('.row').forEach(row => {
          row.classList.remove('registered');

          const cb = row.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = false;
        });

        // 3. Reset UI behavior
        collapsedSections.clear();
        autoCollapsedSections.clear();
        userExpandedSections.clear();
        isInitialLoad = true;

        refreshUI();
      }

      select.value = '';
      return;
    }

    /* ===== RESET SINGLE SECTION ===== */
    if (!confirm(`Reset "${sectionKey}" for ${currentVersion}?`)) {
      select.value = '';
      return;
    }

    resetSectionByKey(sectionKey);
    select.value = '';
  });
}

/* =========================================================
   MOBILE IMAGE ZOOM HELPER (POKEDEX STYLE)
   ========================================================= */
function enableMobileImageZoom() {
  let activeImg = null;

  document.addEventListener('touchstart', e => {
    const img = e.target.closest('.row img');
    if (!img) {
      // Tapped outside → reset zoom
      if (activeImg) {
        activeImg.classList.remove('mobile-zoom');
        activeImg = null;
      }
      return;
    }

    // If tapping the same image → toggle off
    if (activeImg === img) {
      img.classList.remove('mobile-zoom');
      activeImg = null;
      return;
    }

    // Otherwise, zoom new image
    if (activeImg) {
      activeImg.classList.remove('mobile-zoom');
    }

    img.classList.add('mobile-zoom');
    activeImg = img;
  }, { passive: true });
}

/* =========================================================
   LOADING OVERLAY HELPERS
   ========================================================= */
function showLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.remove('hidden');
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.add('hidden');
}

function triggerCelebrationIfNeeded(totalCaught) {
  const map = OBJECTIVE_COMPLETIONS[currentVersion];
  if (!map) return;

  const message = map[totalCaught];
  if (!message) return;

  if (completedObjectives.has(message)) return;
  completedObjectives.add(message);

  const el = document.getElementById('celebration');
  if (!el) return;

  el.textContent = message;
  el.classList.remove('hidden', 'show');

  // force reflow to restart animation
  void el.offsetWidth;

  el.classList.add('show');

  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hidden');
  }, 2500);
}

/* =========================================================
   EVENT WIRING
   ========================================================= */
window.addEventListener('load', () => {
  wireVersionDropdown();
  wireResetDropdown();
  rebuildResetDropdown();

  loadPokemonData();
  enableMobileImageZoom();
  syncTopBarOffset();

  wireMuteButton();
});

/* =========================================================
   OAK CHALLENGE (GitHub/JSON Backend) — script.js
   - Loads data from:   data/gen1/red.json | blue.json | yellow.json
   - Loads sprites from: assets/sprites/{dex}-{slug}.gif
   - Loads cries from:   assets/cries/{dex}.ogg
   - Persists progress in localStorage per version
   - All rules (starter exclusivity, etc.) are JSON-driven
   ========================================================= */

/* =========================================================
   GLOBAL STATE
   ========================================================= */
let currentVersion = 'Red';
let currentData = null;             // the loaded JSON for the current version
let pokemonList = [];               // flattened render list: headers + pokemon rows
let state = {};                     // { [pokemonId]: true/false }
let collapsedSections = new Set();  // Set<sectionKey> collapsed
let userExpandedSections = new Set(); // Set<sectionKey> sections user forced open
let completedAchievements = new Set();
let isInitialLoad = true;
let achievementQueue = [];

const STORAGE_KEY = 'oak-challenge-v1';
const STORAGE_MUTE_KEY = 'criesMuted';
const BASE_URL = new URL('.', document.baseURI); // folder containing index.html
const urlFromBase = (p) => new URL(p, BASE_URL).toString();

/* =========================================================
   CRY SYSTEM
   ========================================================= */
const CRY_BASE_URL = urlFromBase('assets/cries/');
let activeCry = null;

let criesMuted = false;
try { criesMuted = localStorage.getItem(STORAGE_MUTE_KEY) === 'true'; } catch {}

function playPokemonCry(dex) {
  if (!dex || criesMuted) return;

  if (activeCry) {
    activeCry.pause();
    activeCry.currentTime = 0;
  }

  const audio = new Audio(`${CRY_BASE_URL}${String(dex).padStart(3, '0')}.ogg`);
  audio.volume = 0.6;

  audio.play().catch(err => {
    // mobile browsers may block autoplay; expected until user interacts
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

    if (criesMuted && activeCry) {
      activeCry.pause();
      activeCry.currentTime = 0;
    }

    try { localStorage.setItem(STORAGE_MUTE_KEY, String(criesMuted)); } catch {}
    updateIcon();
  });
}

/* =========================================================
   LOCAL STORAGE
   ========================================================= */
function loadAllProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAllProgress(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function loadProgressForVersion(version) {
  const all = loadAllProgress();
  return all[version] || {};
}

function saveProgressForVersion(version, versionState) {
  const all = loadAllProgress();
  all[version] = versionState;
  saveAllProgress(all);
}

function clearProgressForVersion(version) {
  const all = loadAllProgress();
  delete all[version];
  saveAllProgress(all);
}

/* =========================================================
   UTILITIES
   ========================================================= */
function slugifyName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\.(gif|png|jpg|jpeg)$/i, '')
    .replace(/#[0-9]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')   // hyphenate
    .replace(/^-+|-+$/g, '')
    .trim();
}

function dex3(dex) {
  // supports numeric or string
  const n = String(dex).replace(/\D/g, '');
  return n.padStart(3, '0');
}

function pokemonId(sectionKey, dex) {
  return `${sectionKey}:${dex3(dex)}`;
}

function setBodyTheme(version) {
  document.body.classList.remove('red', 'blue', 'yellow');
  document.body.classList.add(String(version).toLowerCase());
}

/* =========================================================
   DATA LOADING
   ========================================================= */
async function loadPokemonData() {
  const versionKey = String(currentVersion).toLowerCase();
  const path = urlFromBase(`data/gen1/${versionKey}.json`);

  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('hidden');

  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);

    const data = await res.json();
    currentData = data;

    // load state
    state = loadProgressForVersion(currentVersion) || {};
    completedAchievements = loadCompletedAchievements(currentVersion);

    // flatten into render list
    pokemonList = [];
    data.sections.forEach(section => {
      pokemonList.push({
        type: 'header',
        key: section.key,
        title: section.title
      });

      section.pokemon.forEach(p => {
        const d = dex3(p.dex);
        pokemonList.push({
          type: 'pokemon',
          sectionKey: section.key,
          id: pokemonId(section.key, d),
          dex: d,
          name: p.name,
          info: p.info || '',
          notes: p.notes || '',
          image: p.image
            ? p.image
            : urlFromBase(`assets/sprites/${d}-${slugifyName(p.name)}.gif`)
        });
      });
    });

    // reset UI state
    collapsedSections.clear();
    userExpandedSections.clear();

    rebuildResetDropdown();
    renderRows();
    syncTopBarHeight();
    refreshUI();

    isInitialLoad = false;

  } catch (err) {
    console.error(err);
    alert(`Could not load data for ${currentVersion}. Check console for details.`);
  } finally {
    if (overlay) overlay.classList.add('hidden');
  }
}

function showSectionAchievement(text) {
  const el = document.getElementById('celebration');
  if (!el) return;

  el.textContent = text;

  // restart animation cleanly
  el.classList.remove('show');

  // Force reflow
  void el.offsetWidth;

  // Show next frame so the browser actually paints it
  requestAnimationFrame(() => {
    el.classList.add('show');

    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 3000);
  });
}

function loadCompletedAchievements(version) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return new Set(all[`${version}_completed`] || []);
  } catch {
    return new Set();
  }
}

function saveCompletedAchievements(version, set) {
  const all = loadAllProgress();
  all[`${version}_completed`] = Array.from(set);
  saveAllProgress(all);
}

/* =========================================================
   RENDERING
   ========================================================= */
function renderRows() {
  const c = document.getElementById('rows');
  if (!c) return;

  c.innerHTML = '';

  pokemonList.forEach(item => {
    if (item.type === 'header') {
      const h = document.createElement('div');
      h.className = 'section-header major-header';
      h.dataset.section = item.key;
      h.textContent = item.title;

      h.addEventListener('click', () => {
        const key = item.key;
        if (collapsedSections.has(key)) {
          collapsedSections.delete(key);
          userExpandedSections.add(key);
        } else {
          collapsedSections.add(key);
          userExpandedSections.delete(key);
        }

        h.classList.toggle('collapsed', collapsedSections.has(key));
        refreshUI();
      });

      c.appendChild(h);
      return;
    }

    if (item.type === 'pokemon') {
      const r = document.createElement('div');
      r.className = 'row';
      r.dataset.id = item.id;
      r.dataset.section = item.sectionKey;

      // functional checkbox (hidden in CSS)
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!state[item.id];
      cb.style.display = 'none';

      const ball = document.createElement('div');
      ball.className = 'pokeball';

      if (cb.checked) r.classList.add('registered');

      const toggle = () => {
        const wasChecked = cb.checked;
        cb.checked = !cb.checked;

        state[item.id] = cb.checked;
        if (!cb.checked) delete state[item.id];

        saveProgressForVersion(currentVersion, state);
        r.classList.toggle('registered', cb.checked);

        if (!wasChecked && cb.checked) playPokemonCry(item.dex);

        refreshUI();
      };

      // Make entire row toggle, but don't double-toggle
      r.addEventListener('click', toggle);
      ball.addEventListener('click', e => {
        e.stopPropagation();
        toggle();
      });

      const sprite = document.createElement('div');
      sprite.className = 'sprite-frame';

      const img = document.createElement('img');
      img.alt = item.name;
      img.loading = 'lazy';
      img.src = item.image;
      sprite.appendChild(img);

      const t = document.createElement('div');
      t.className = 'text';
      t.innerHTML = `
        <div class="name">${escapeHtml(item.name)}</div>
        ${item.info ? `<div class="info">${escapeHtml(item.info)}</div>` : ''}
        ${item.notes ? `<div class="notes">${escapeHtml(item.notes)}</div>` : ''}
      `;

      r.append(cb, ball, sprite, t);
      c.appendChild(r);
    }
  });
}

// minimal escaping so a note can’t break your layout
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* =========================================================
   UI RULES (JSON-DRIVEN)
   ========================================================= */
function hideById(id) {
  const el = document.querySelector(`.row[data-id="${cssEscape(id)}"]`);
  if (el) el.classList.add('hidden');
}

function showAllRows() {
  document.querySelectorAll('.row').forEach(r => r.classList.remove('hidden'));
}

function cssEscape(s) {
  // basic CSS.escape fallback
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/["\\]/g, '\\$&');
}

function applySectionCollapseRules() {
  if (!currentData) return;

  collapsedSections.forEach(sectionKey => {
    // If the user explicitly expanded it, do NOT collapse
    if (userExpandedSections.has(sectionKey)) return;

    // Hide rows
    document
      .querySelectorAll(`.row[data-section="${cssEscape(sectionKey)}"]`)
      .forEach(row => row.classList.add('hidden'));

    // Mark header as collapsed (for styling + state clarity)
    const header = document.querySelector(
      `.section-header[data-section="${cssEscape(sectionKey)}"]`
    );
    if (header) {
      header.classList.add('collapsed');
    }
  });
}

function applyStarterExclusivity() {
  if (!currentData) return;
  const section = currentData.sections.find(s => s.key === 'STARTER');
  if (!section || !section.exclusive || !Array.isArray(section.families)) return;

  const families = section.families.map(fam => {
    // fam = ["Bulbasaur","Ivysaur","Venusaur"]
    return fam
      .map(name => {
        // find by name within STARTER section
        return pokemonList.find(p =>
          p.type === 'pokemon' &&
          p.sectionKey === 'STARTER' &&
          String(p.name) === String(name)
        );
      })
      .filter(Boolean);
  });

  const chosenFamily = families.find(fam => fam.some(p => !!state[p.id]));
  if (!chosenFamily) return; // nothing chosen yet

  families.forEach(fam => {
    if (fam === chosenFamily) return;
    fam.forEach(p => hideById(p.id));
  });
}

function syncTopBarHeight() {
  const topBar = document.querySelector('.top-bar');
  if (!topBar) return;

  const height = topBar.getBoundingClientRect().height;
  document.documentElement.style.setProperty(
    '--top-bar-height',
    `${height}px`
  );
}

function applyExclusiveGroups() {
  // optional: supports "exclusiveGroups" at root of JSON:
  // "exclusiveGroups": [{ "section":"FOSSIL", "families":[["Omanyte","Omastar"],["Kabuto","Kabutops"]] }]
  if (!currentData || !Array.isArray(currentData.exclusiveGroups)) return;

  currentData.exclusiveGroups.forEach(group => {
    const sectionKey = group.section;
    if (!sectionKey || !Array.isArray(group.families) || group.families.length < 2) return;

    // build family rows
    const famRows = group.families.map(fam =>
      fam
        .map(name => pokemonList.find(p =>
          p.type === 'pokemon' &&
          p.sectionKey === sectionKey &&
          p.name === name
        ))
        .filter(Boolean)
    );

    const chosenIndex = famRows.findIndex(fam => fam.some(p => !!state[p.id]));
    if (chosenIndex === -1) return;

    famRows.forEach((fam, idx) => {
      if (idx === chosenIndex) return;
      fam.forEach(p => hideById(p.id));
    });
  });
}

function applyFinalEvolutionDeduping() {
  if (!currentData || !Array.isArray(currentData.dedupeFinalEvos)) return;

  // Normalize names for matching
  const targets = new Set(
    currentData.dedupeFinalEvos.map(name => slugifyName(name))
  );

  // Group all matching Pokémon by name, across ALL sections
  const groups = {}; // { slugName: [pokemonItem, pokemonItem] }

  pokemonList.forEach(p => {
    if (p.type !== 'pokemon') return;

    const slug = slugifyName(p.name);
    if (!targets.has(slug)) return;

    if (!groups[slug]) groups[slug] = [];
    groups[slug].push(p);
  });

  // If one is checked, hide the others
  Object.values(groups).forEach(list => {
    const chosen = list.find(p => state[p.id]);
    if (!chosen) return;

    list.forEach(p => {
      if (p.id !== chosen.id) {
        hideById(p.id);
      }
    });
  });
}

/* =========================================================
   PROGRESS + OBJECTIVE
   ========================================================= */
function getTotalCaught() {
  return Object.keys(state).length;
}

function updateCounterAndBar() {
  if (!currentData) return;

  const caught = getTotalCaught();
  const total = Number(currentData.total) || 0;

  const counterEl = document.getElementById('global-counter');
  if (counterEl) counterEl.textContent = `${caught}/${total} Caught`;

  const bar = document.getElementById('progress-bar');
  if (bar && total > 0) {
    bar.style.width = `${Math.min(caught / total, 1) * 100}%`;
  }
}

function updateCurrentObjective() {
  // If your HTML uses IDs for these, prefer that.
  // Your earlier HTML had class="current-objective" and spans.
  const objectiveText = document.querySelector('.objective-text');
  if (!objectiveText || !currentData) return;

  // Find first section that isn't complete (based on required)
  let label = 'CHALLENGE COMPLETE!';
  for (const section of currentData.sections) {
    const required = Number(section.required) || 0;
    if (required <= 0) continue;

    const caughtInSection = section.pokemon.reduce((acc, p) => {
      const id = pokemonId(section.key, p.dex);
      return acc + (state[id] ? 1 : 0);
    }, 0);

    if (caughtInSection < required) {
      label = section.objectiveLabel || section.title;
      break;
    }
  }

  // small swap animation if you kept your .swap class
  if (objectiveText.textContent !== label) {
    objectiveText.classList.add('swap');
    setTimeout(() => {
      objectiveText.textContent = label;
      objectiveText.classList.remove('swap');
    }, 180);
  }
}

/* =========================================================
   RESET DROPDOWN
   ========================================================= */
function rebuildResetDropdown() {
  const select = document.getElementById('reset');
  if (!select || !currentData) return;

  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Reset →';
  select.appendChild(placeholder);

  const resetAll = document.createElement('option');
  resetAll.value = 'RESET_ALL';
  resetAll.textContent = 'Reset All';
  select.appendChild(resetAll);

  currentData.sections.forEach(section => {
    const opt = document.createElement('option');
    opt.value = section.key;
    opt.textContent = section.resetLabel || section.title;
    select.appendChild(opt);
  });
}

function resetAll() {
  if (!currentData) return;

  // Clear Pokémon progress
  state = {};
  saveProgressForVersion(currentVersion, state);

  // Clear achievements for this version
  completedAchievements.clear();
  saveCompletedAchievements(currentVersion, completedAchievements);

  // Reset UI state
  collapsedSections.clear();
  userExpandedSections.clear();

  renderRows();
  refreshUI();
}

function resetSection(sectionKey) {
  if (!currentData) return;

  const section = currentData.sections.find(s => s.key === sectionKey);
  if (!section) return;

  section.pokemon.forEach(p => {
    const id = pokemonId(sectionKey, p.dex);
    delete state[id];
  });

  saveProgressForVersion(currentVersion, state);

  // ensure section is expanded after reset
  collapsedSections.delete(sectionKey);
  userExpandedSections.delete(sectionKey);

  renderRows();
  refreshUI();
}

function wireResetDropdown() {
  const select = document.getElementById('reset');
  if (!select) return;

  select.addEventListener('change', () => {
    const value = select.value;
    if (!value) return;

    if (value === 'RESET_ALL') {
      if (confirm('Reset all progress?')) resetAll();
      select.value = '';
      return;
    }

    if (confirm(`Reset "${value}" for ${currentVersion}?`)) {
      resetSection(value);
    }

    select.value = '';
  });
}

/* =========================================================
   VERSION DROPDOWN
   ========================================================= */
function wireVersionDropdown() {
  const select = document.getElementById('version');
  if (!select) return;

  select.value = currentVersion;

  select.addEventListener('change', () => {
    currentVersion = select.value || 'Red';
    setBodyTheme(currentVersion);

    // load new JSON + state
    loadPokemonData();
  });
}

function applyAutoSectionCompletion() {
  if (!currentData) return;

  currentData.sections.forEach(section => {
    const required = Number(section.required) || 0;
    if (required <= 0) return;

    const caught = section.pokemon.reduce((count, p) => {
      const id = pokemonId(section.key, p.dex);
      return count + (state[id] ? 1 : 0);
    }, 0);

    const isComplete = caught >= required;
    const alreadyAwarded = completedAchievements.has(section.key);

    // 🎉 Detect transition ONLY
    if (isComplete && !alreadyAwarded) {
      completedAchievements.add(section.key);
      saveCompletedAchievements(currentVersion, completedAchievements);

      const label =
        section.title?.toUpperCase() ||
        section.key.replace(/_/g, ' ');

      achievementQueue.push(`${label} COMPLETE!`);
    }

    // Auto-collapse
    if (isComplete && !userExpandedSections.has(section.key)) {
      collapsedSections.add(section.key);
    }

    // Header state
    const header = document.querySelector(
      `.section-header[data-section="${section.key}"]`
    );

    if (header) {
      header.classList.toggle('completed', isComplete);
      header.classList.toggle(
        'collapsed',
        isComplete && !userExpandedSections.has(section.key)
      );
    }
  });
}
/* =========================================================
   MOBILE IMAGE ZOOM HELPER
   ========================================================= */
function enableMobileImageZoom() {
  let activeImg = null;

  document.addEventListener('touchstart', e => {
    const img = e.target.closest('.row img');
    if (!img) {
      if (activeImg) {
        activeImg.classList.remove('mobile-zoom');
        activeImg = null;
      }
      return;
    }

    if (activeImg === img) {
      img.classList.remove('mobile-zoom');
      activeImg = null;
      return;
    }

    if (activeImg) activeImg.classList.remove('mobile-zoom');

    img.classList.add('mobile-zoom');
    activeImg = img;
  }, { passive: true });
}

/* =========================================================
   REFRESH UI (single orchestrator)
   ========================================================= */
function refreshUI() {
  if (!currentData) return;

  // 1) Reset visibility baseline
  showAllRows();

  // 2) Apply “hide” rules first
  applyStarterExclusivity();
  applyExclusiveGroups();
  applyFinalEvolutionDeduping();

  // 3) Compute completion + collapse + header state
  applyAutoSectionCompletion();

  // 4) Apply collapses last
  applySectionCollapseRules();

  // 5) UI updates
  updateCounterAndBar();
  updateCurrentObjective();

  // 6) Fire ONE queued achievement after UI settles
  if (achievementQueue.length) {
    showSectionAchievement(achievementQueue.shift());
  }
}
/* =========================================================
   INIT
   ========================================================= */
window.addEventListener('load', () => {
  // theme
  setBodyTheme(currentVersion);

  // wires
  wireVersionDropdown();
  wireResetDropdown();
  wireMuteButton();
  enableMobileImageZoom();
  syncTopBarHeight();

  // load initial data
  loadPokemonData();
});

window.addEventListener('resize', () => {
  syncTopBarHeight();
});

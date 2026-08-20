/**
 * MyPlant — Full Pl@ntNet integration
 * Identify plants, search species, enrich with GBIF
 */

const API_BASE = 'https://my-api.plantnet.org/v2';
const GBIF_BASE = 'https://api.gbif.org/v1';

// State
let selectedFiles = [];
const state = {
  apiKey: localStorage.getItem('myplant_api_key') || '',
};

// DOM
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Tabs ───────────────────────────────────────────────────────────────────
$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach((b) => b.classList.remove('active'));
    $$('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    $(`#${btn.dataset.tab}`).classList.add('active');
  });
});

// ─── Settings ───────────────────────────────────────────────────────────────
const apiKeyInput = $('#apiKeyInput');
const keyStatus = $('#keyStatus');

if (state.apiKey) {
  apiKeyInput.value = state.apiKey;
  keyStatus.textContent = 'API key loaded from local storage';
  keyStatus.className = 'status ok';
}

$('#saveKeyBtn').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = 'Please enter a valid API key';
    keyStatus.className = 'status err';
    return;
  }
  state.apiKey = key;
  localStorage.setItem('myplant_api_key', key);
  keyStatus.textContent = 'API key saved successfully';
  keyStatus.className = 'status ok';
});

$('#toggleKeyBtn').addEventListener('click', () => {
  const isPass = apiKeyInput.type === 'password';
  apiKeyInput.type = isPass ? 'text' : 'password';
  $('#toggleKeyBtn').textContent = isPass ? 'Hide' : 'Show';
});

// ─── File Upload ────────────────────────────────────────────────────────────
const uploadZone = $('#uploadZone');
const fileInput = $('#fileInput');
const previewGrid = $('#previewGrid');
const optionsRow = $('#optionsRow');
const actions = $('#actions');

$('#browseBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
});

function handleFiles(fileList) {
  const files = Array.from(fileList).filter(
    (f) => f.type === 'image/jpeg' || f.type === 'image/png'
  );
  if (!files.length) return;

  // Max 5
  selectedFiles = [...selectedFiles, ...files].slice(0, 5);
  renderPreviews();
  optionsRow.classList.remove('hidden');
  actions.classList.remove('hidden');
}

function renderPreviews() {
  previewGrid.innerHTML = '';
  if (!selectedFiles.length) {
    previewGrid.classList.add('hidden');
    optionsRow.classList.add('hidden');
    actions.classList.add('hidden');
    return;
  }
  previewGrid.classList.remove('hidden');

  selectedFiles.forEach((file, i) => {
    const div = document.createElement('div');
    div.className = 'preview-item';
    const url = URL.createObjectURL(file);
    div.innerHTML = `
      <img src="${url}" alt="Plant photo ${i + 1}" />
      <button class="remove" data-i="${i}" title="Remove">×</button>
    `;
    previewGrid.appendChild(div);
  });

  previewGrid.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFiles.splice(+btn.dataset.i, 1);
      renderPreviews();
    });
  });
}

$('#clearBtn').addEventListener('click', () => {
  selectedFiles = [];
  fileInput.value = '';
  renderPreviews();
  $('#results').classList.add('hidden');
  $('#results').innerHTML = '';
});

// ─── Identify ───────────────────────────────────────────────────────────────
$('#identifyBtn').addEventListener('click', async () => {
  if (!state.apiKey) {
    showError('Please set your Pl@ntNet API key in Settings first.');
    $$('.nav-btn').forEach((b) => b.classList.remove('active'));
    $$('.tab').forEach((t) => t.classList.remove('active'));
    $('[data-tab="settings"]').classList.add('active');
    $('#settings').classList.add('active');
    return;
  }
  if (!selectedFiles.length) {
    showError('Please upload at least one photo.');
    return;
  }

  const btn = $('#identifyBtn');
  const spinner = btn.querySelector('.spinner');
  const btnText = btn.querySelector('.btn-text');
  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Identifying…';

  try {
    const formData = new FormData();
    const organ = $('#organSelect').value;
    selectedFiles.forEach((file) => {
      formData.append('images', file);
      formData.append('organs', organ);
    });

    const project = $('#projectSelect').value;
    const lang = $('#langSelect').value;
    const params = new URLSearchParams({
      'api-key': state.apiKey,
      lang,
      'include-related-images': 'true',
      'nb-results': '10',
    });

    const res = await fetch(
      `${API_BASE}/identify/${project}?${params}`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      const errText = await res.text();
      let msg = `API error ${res.status}`;
      try {
        const j = JSON.parse(errText);
        msg = j.message || j.error || msg;
      } catch (_) {}
      if (res.status === 401 || res.status === 403) {
        msg = 'Invalid or unauthorized API key. Check Settings and make sure your domain is authorized.';
      } else if (res.status === 429) {
        msg = 'Daily quota exceeded. Try again tomorrow or upgrade your Pl@ntNet plan.';
      } else if (res.status === 404) {
        msg = 'No plant species found. Try clearer photos of flower/leaf/fruit.';
      }
      throw new Error(msg);
    }

    const data = await res.json();
    renderIdentifyResults(data);
  } catch (err) {
    showError(err.message || 'Identification failed');
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Identify Plant';
  }
});

function showError(msg) {
  const results = $('#results');
  results.classList.remove('hidden');
  results.innerHTML = `<div class="error-box">${escapeHtml(msg)}</div>`;
}

function renderIdentifyResults(data) {
  const results = $('#results');
  results.classList.remove('hidden');

  if (!data.results || !data.results.length) {
    results.innerHTML = `
      <div class="empty-state">
        <p>No matching species found. Try different or clearer photos.</p>
      </div>`;
    return;
  }

  let html = `
    <div style="margin-bottom:16px;color:var(--text-muted);font-size:0.9rem">
      Best match: <strong style="color:var(--primary)">${escapeHtml(data.bestMatch || '')}</strong>
      ${data.remainingIdentificationRequests != null
        ? ` • Remaining requests today: ${data.remainingIdentificationRequests}`
        : ''}
      ${data.version ? ` • Model: ${escapeHtml(data.version)}` : ''}
    </div>
  `;

  data.results.forEach((r, idx) => {
    const sp = r.species || {};
    const scorePct = Math.round((r.score || 0) * 100);
    const common = (sp.commonNames || []).slice(0, 4).join(', ');
    const scientific = sp.scientificName || `${sp.scientificNameWithoutAuthor || ''} ${sp.scientificNameAuthorship || ''}`.trim();
    const family = sp.family?.scientificNameWithoutAuthor || sp.family?.scientificName || '';
    const genus = sp.genus?.scientificNameWithoutAuthor || sp.genus?.scientificName || '';
    const gbifId = r.gbif?.id || sp.gbif?.id;
    const powoId = r.powo?.id || sp.powo?.id;

    html += `
      <div class="result-card" data-idx="${idx}" data-scientific="${escapeHtml(sp.scientificNameWithoutAuthor || '')}" data-gbif="${gbifId || ''}">
        <div class="result-header">
          <h3>${escapeHtml(scientific)}</h3>
          <span class="score">${scorePct}%</span>
        </div>
        ${common ? `<p class="common-names">${escapeHtml(common)}</p>` : ''}
        <div class="taxonomy">
          ${family ? `<span class="tag family">Family: ${escapeHtml(family)}</span>` : ''}
          ${genus ? `<span class="tag genus">Genus: ${escapeHtml(genus)}</span>` : ''}
        </div>
        <div class="links">
          ${gbifId ? `<a href="https://www.gbif.org/species/${gbifId}" target="_blank" rel="noopener">GBIF ↗</a>` : ''}
          ${powoId ? `<a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:${powoId}" target="_blank" rel="noopener">POWO ↗</a>` : ''}
          <a href="#" class="detail-link" data-idx="${idx}">More info</a>
        </div>
      </div>
    `;
  });

  results.innerHTML = html;

  // Store results for modal
  window.__lastResults = data.results;

  results.querySelectorAll('.detail-link, .result-card').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' && !e.target.classList.contains('detail-link')) return;
      e.preventDefault();
      const idx = +(el.dataset.idx ?? el.closest('.result-card')?.dataset.idx);
      if (!isNaN(idx)) openDetailModal(window.__lastResults[idx]);
    });
  });
}

// ─── Species Search ─────────────────────────────────────────────────────────
$('#searchBtn').addEventListener('click', doSpeciesSearch);
$('#speciesSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSpeciesSearch();
});

async function doSpeciesSearch() {
  if (!state.apiKey) {
    showSearchError('Please set your Pl@ntNet API key in Settings first.');
    return;
  }
  const q = $('#speciesSearch').value.trim();
  if (!q) return;

  const container = $('#searchResults');
  container.innerHTML = `<div class="empty-state">Searching…</div>`;

  try {
    // Use species list with prefix
    const params = new URLSearchParams({
      'api-key': state.apiKey,
      prefix: q,
      pageSize: '20',
      page: '1',
      lang: 'en',
    });

    const res = await fetch(`${API_BASE}/projects/k-world-flora/species?${params}`);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Invalid or unauthorized API key.');
      }
      throw new Error(`Search failed (${res.status})`);
    }

    const list = await res.json();
    if (!Array.isArray(list) || !list.length) {
      // Fallback: try align
      await tryAlign(q, container);
      return;
    }

    renderSpeciesList(list, container);
  } catch (err) {
    showSearchError(err.message);
  }
}

async function tryAlign(name, container) {
  try {
    const params = new URLSearchParams({
      'api-key': state.apiKey,
      name,
      authorship: 'false',
      synonyms: 'true',
    });
    const res = await fetch(
      `${API_BASE}/projects/k-world-flora/species/align?${params}`
    );
    if (!res.ok) throw new Error('No match found');
    const data = await res.json();
    renderSpeciesList(
      [
        {
          scientificNameWithoutAuthor: data.matchingName?.split(' ')[0] + ' ' + (data.matchingName?.split(' ').slice(1).join(' ') || ''),
          scientificNameAuthorship: '',
          commonNames: [],
          family: data.family,
          genus: data.genus,
          gbifId: data.gbif?.id,
          powoId: data.powo?.id,
          iucnCategory: data.iucn?.id ? 'see IUCN' : null,
        },
      ],
      container,
      data
    );
  } catch {
    container.innerHTML = `<div class="empty-state">No species found for “${escapeHtml(name)}”</div>`;
  }
}

function renderSpeciesList(list, container, alignExtra = null) {
  let html = '';
  list.forEach((sp) => {
    const scientific = `${sp.scientificNameWithoutAuthor || ''} ${sp.scientificNameAuthorship || ''}`.trim();
    const common = (sp.commonNames || []).slice(0, 5).join(', ');
    const family = sp.family || '';
    const genus = sp.genus || '';
    const gbifId = sp.gbifId || sp.gbif?.id;
    const powoId = sp.powoId || sp.powo?.id;

    html += `
      <div class="result-card" data-scientific="${escapeHtml(sp.scientificNameWithoutAuthor || '')}" data-gbif="${gbifId || ''}">
        <div class="result-header">
          <h3>${escapeHtml(scientific)}</h3>
          ${sp.iucnCategory ? `<span class="tag">IUCN: ${escapeHtml(String(sp.iucnCategory))}</span>` : ''}
        </div>
        ${common ? `<p class="common-names">${escapeHtml(common)}</p>` : ''}
        <div class="taxonomy">
          ${family ? `<span class="tag family">Family: ${escapeHtml(typeof family === 'string' ? family : family.scientificNameWithoutAuthor || '')}</span>` : ''}
          ${genus ? `<span class="tag genus">Genus: ${escapeHtml(typeof genus === 'string' ? genus : genus.scientificNameWithoutAuthor || '')}</span>` : ''}
        </div>
        <div class="links">
          ${gbifId ? `<a href="https://www.gbif.org/species/${gbifId}" target="_blank" rel="noopener">GBIF ↗</a>` : ''}
          ${powoId ? `<a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:${powoId}" target="_blank" rel="noopener">POWO ↗</a>` : ''}
          <a href="#" class="species-detail" data-gbif="${gbifId || ''}" data-name="${escapeHtml(sp.scientificNameWithoutAuthor || '')}">More info</a>
        </div>
      </div>
    `;
  });
  container.innerHTML = html || `<div class="empty-state">No results</div>`;

  container.querySelectorAll('.species-detail, .result-card').forEach((el) => {
    el.addEventListener('click', async (e) => {
      if (e.target.tagName === 'A' && !e.target.classList.contains('species-detail')) return;
      e.preventDefault();
      const gbif = el.dataset.gbif || el.closest('.result-card')?.dataset.gbif;
      const name = el.dataset.name || el.closest('.result-card')?.dataset.scientific;
      openSpeciesDetail(name, gbif);
    });
  });
}

function showSearchError(msg) {
  $('#searchResults').innerHTML = `<div class="error-box">${escapeHtml(msg)}</div>`;
}

// ─── Detail Modal + GBIF enrichment ─────────────────────────────────────────
async function openDetailModal(result) {
  const sp = result.species || {};
  const scientific = sp.scientificName || `${sp.scientificNameWithoutAuthor || ''} ${sp.scientificNameAuthorship || ''}`.trim();
  const common = (sp.commonNames || []).join(', ');
  const family = sp.family?.scientificNameWithoutAuthor || '';
  const genus = sp.genus?.scientificNameWithoutAuthor || '';
  const gbifId = result.gbif?.id || sp.gbif?.id;
  const scorePct = Math.round((result.score || 0) * 100);

  let body = `
    <h2>${escapeHtml(scientific)}</h2>
    <p style="color:var(--text-muted);margin-bottom:12px">${escapeHtml(common)}</p>
    <div class="taxonomy" style="margin-bottom:16px">
      ${family ? `<span class="tag family">Family: ${escapeHtml(family)}</span>` : ''}
      ${genus ? `<span class="tag genus">Genus: ${escapeHtml(genus)}</span>` : ''}
      <span class="tag">Confidence: ${scorePct}%</span>
    </div>
    <div class="links">
      ${gbifId ? `<a href="https://www.gbif.org/species/${gbifId}" target="_blank">Open on GBIF ↗</a>` : ''}
      ${result.powo?.id ? `<a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:${result.powo.id}" target="_blank">Open on POWO ↗</a>` : ''}
    </div>
  `;

  // Related images from PlantNet if available
  if (result.images && result.images.length) {
    body += `<div class="gbif-section"><h4>Similar observations (Pl@ntNet)</h4><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">`;
    result.images.slice(0, 6).forEach((img) => {
      const url = img.url?.m || img.url?.s || img.url?.o;
      if (url) {
        body += `<img src="${url}" alt="Similar" style="width:90px;height:90px;object-fit:cover;border-radius:8px" loading="lazy" />`;
      }
    });
    body += `</div></div>`;
  }

  body += `<div class="gbif-section" id="gbifExtra"><p style="color:var(--text-muted)">Loading extra data from GBIF…</p></div>`;

  $('#modalBody').innerHTML = body;
  $('#modal').classList.remove('hidden');

  if (gbifId) {
    enrichWithGBIF(gbifId);
  } else if (sp.scientificNameWithoutAuthor) {
    // Try to resolve via GBIF match
    try {
      const matchRes = await fetch(
        `${GBIF_BASE}/species/match?name=${encodeURIComponent(sp.scientificNameWithoutAuthor)}`
      );
      const match = await matchRes.json();
      if (match.usageKey) enrichWithGBIF(match.usageKey);
      else $('#gbifExtra').innerHTML = '<p style="color:var(--text-muted)">No additional GBIF data found.</p>';
    } catch {
      $('#gbifExtra').innerHTML = '';
    }
  } else {
    $('#gbifExtra').innerHTML = '';
  }
}

async function openSpeciesDetail(name, gbifId) {
  let body = `<h2>${escapeHtml(name || 'Species')}</h2>`;
  body += `<div class="gbif-section" id="gbifExtra"><p style="color:var(--text-muted)">Loading data…</p></div>`;
  $('#modalBody').innerHTML = body;
  $('#modal').classList.remove('hidden');

  if (gbifId) {
    enrichWithGBIF(gbifId);
  } else if (name) {
    try {
      const matchRes = await fetch(
        `${GBIF_BASE}/species/match?name=${encodeURIComponent(name)}`
      );
      const match = await matchRes.json();
      if (match.usageKey) enrichWithGBIF(match.usageKey);
      else $('#gbifExtra').innerHTML = '<p style="color:var(--text-muted)">No match found on GBIF.</p>';
    } catch {
      $('#gbifExtra').innerHTML = '<p style="color:var(--text-muted)">Could not reach GBIF.</p>';
    }
  }
}

async function enrichWithGBIF(key) {
  const el = $('#gbifExtra');
  if (!el) return;

  try {
    const [speciesRes, vernRes, mediaRes] = await Promise.all([
      fetch(`${GBIF_BASE}/species/${key}`),
      fetch(`${GBIF_BASE}/species/${key}/vernacularNames?limit=20`),
      fetch(`${GBIF_BASE}/species/${key}/media?limit=6`),
    ]);

    const species = await speciesRes.json();
    const vern = await vernRes.json();
    const media = await mediaRes.json();

    let html = `<h4>Taxonomy (GBIF)</h4>
      <p><strong>${escapeHtml(species.scientificName || '')}</strong></p>
      <div class="taxonomy" style="margin:8px 0 16px">
        ${species.kingdom ? `<span class="tag">Kingdom: ${escapeHtml(species.kingdom)}</span>` : ''}
        ${species.phylum ? `<span class="tag">Phylum: ${escapeHtml(species.phylum)}</span>` : ''}
        ${species.class ? `<span class="tag">Class: ${escapeHtml(species.class)}</span>` : ''}
        ${species.order ? `<span class="tag">Order: ${escapeHtml(species.order)}</span>` : ''}
        ${species.family ? `<span class="tag family">Family: ${escapeHtml(species.family)}</span>` : ''}
        ${species.genus ? `<span class="tag genus">Genus: ${escapeHtml(species.genus)}</span>` : ''}
      </div>`;

    if (species.taxonomicStatus) {
      html += `<p style="font-size:0.9rem;color:var(--text-muted)">Status: ${escapeHtml(species.taxonomicStatus)}
        ${species.rank ? ` • Rank: ${escapeHtml(species.rank)}` : ''}</p>`;
    }

    // Vernacular names
    const names = (vern.results || [])
      .filter((v) => v.vernacularName)
      .slice(0, 12);
    if (names.length) {
      const byLang = {};
      names.forEach((n) => {
        const lang = n.language || 'other';
        if (!byLang[lang]) byLang[lang] = [];
        if (!byLang[lang].includes(n.vernacularName)) {
          byLang[lang].push(n.vernacularName);
        }
      });
      html += `<h4 style="margin-top:16px">Common names</h4><ul style="padding-left:18px;color:var(--text-muted);font-size:0.9rem">`;
      Object.entries(byLang).forEach(([lang, list]) => {
        html += `<li><strong>${escapeHtml(lang)}</strong>: ${escapeHtml(list.join(', '))}</li>`;
      });
      html += `</ul>`;
    }

    // Media
    const images = (media.results || []).filter((m) => m.identifier || m.references);
    if (images.length) {
      html += `<h4 style="margin-top:16px">Images (GBIF)</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">`;
      images.slice(0, 6).forEach((m) => {
        const src = m.identifier || m.references;
        if (src) {
          html += `<a href="${src}" target="_blank" rel="noopener">
            <img src="${src}" alt="GBIF media" style="width:100px;height:100px;object-fit:cover;border-radius:8px" loading="lazy" onerror="this.parentElement.style.display='none'" />
          </a>`;
        }
      });
      html += `</div>`;
    }

    html += `<p style="margin-top:16px"><a href="https://www.gbif.org/species/${key}" target="_blank" rel="noopener" style="color:var(--accent)">View full record on GBIF ↗</a></p>`;

    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-muted)">Could not load extra GBIF data.</p>`;
  }
}

// Modal close
$('#modalClose').addEventListener('click', () => $('#modal').classList.add('hidden'));
$('.modal-backdrop').addEventListener('click', () => $('#modal').classList.add('hidden'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('#modal').classList.add('hidden');
});

// ─── Utils ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

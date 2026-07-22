# A4 Composer — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer une PWA mobile-first "A4 Composer" permettant de composer des images sur une feuille A4 virtuelle (300 DPI), avec export JPG et impression sans fil.

**Architecture:** Vanilla HTML/CSS/JS, Canvas API (300 DPI), Service Worker offline-first. Un seul fichier `app.js` modulaire (sections commentées) + `icons.js` centralisé. Pas de framework, pas de build step.

**Tech Stack:** HTML5, CSS3 (Glassmorphism), JavaScript vanilla, Canvas API, Lucide Icons (CDN), Service Worker, Manifest.json

---

## Global Constraints

- Mobile-first (Android Chrome), tactile, responsive
- 100% client-side, aucune donnée envoyée à un serveur
- Canvas interne 300 DPI (2480×3508 portrait, 3508×2480 paysage)
- PWA installable, fonctionne offline une fois chargée
- Icônes Lucide via CDN, mapping centralisé dans `icons.js` (remplaçable facilement)
- Code commenté en français
- Aucune dépendance externe sauf Lucide Icons CDN
- Design glassmorphism : fond sombre, blur, bordures semi-transparentes
- Zones de tap minimum 44×44px (accessibilité tactile)

---

## Structure des Fichiers

```
SheetMaker_app/
├── index.html              # Structure HTML, toolbar, canvas A4
├── style.css               # Glassmorphism, layout, responsive
├── app.js                  # Logique principale (sections modulaires)
├── icons.js                # Mapping nom → SVG Lucide
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (cache-first)
└── icons/                  # Icônes PWA
    ├── icon-192.png
    ├── icon-512.png
    └── maskable-512.png
```

---

## Task 1: Structure HTML & CSS de base

**Files:**
- Create: `index.html`
- Create: `style.css`

**Interfaces:**
- Produit : structure HTML avec toolbar, zone canvas A4, styles glassmorphism

- [ ] **Step 1: Créer index.html avec structure de base**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#0f111a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>A4 Composer</title>
  <link rel="stylesheet" href="style.css">
  <link rel="manifest" href="manifest.json">
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
</head>
<body>
  <!-- Zone de travail A4 -->
  <div id="workspace">
    <canvas id="preview"></canvas>
  </div>

  <!-- Barre d'outils principale (bas) -->
  <div id="toolbar-main">
    <div class="toolbar-group" id="group-import">
      <button id="btn-import" class="tool-btn" title="Importer">
        <!-- Icône image-plus insérée par JS -->
      </button>
      <input type="file" id="import-input" multiple accept="image/*" hidden>
    </div>
    
    <div class="toolbar-group" id="group-orientation">
      <button id="btn-portrait" class="tool-btn active" title="Portrait">
        <!-- Icône rectangle-vertical -->
      </button>
      <button id="btn-landscape" class="tool-btn" title="Paysage">
        <!-- Icône rectangle-horizontal -->
      </button>
    </div>
    
    <div class="toolbar-group" id="group-context" style="display:none;">
      <button id="btn-crop" class="tool-btn" title="Recadrer">
        <!-- Icône crop -->
      </button>
      <button id="btn-delete" class="tool-btn" title="Supprimer">
        <!-- Icône trash-2 -->
      </button>
      <button id="btn-front" class="tool-btn" title="Premier plan">
        <!-- Icône bring-to-front -->
      </button>
      <button id="btn-back" class="tool-btn" title="Arrière-plan">
        <!-- Icône send-to-back -->
      </button>
    </div>
    
    <div class="toolbar-group" id="group-export">
      <button id="btn-export" class="tool-btn" title="Exporter JPG">
        <!-- Icône download -->
      </button>
    </div>
  </div>

  <!-- Modal confirmation (changement orientation) -->
  <div id="modal-confirm" class="modal" style="display:none;">
    <div class="modal-content glass">
      <p id="modal-message">Changer l'orientation va réorganiser les images.</p>
      <div class="modal-buttons">
        <button id="modal-cancel" class="modal-btn">Annuler</button>
        <button id="modal-ok" class="modal-btn primary">Confirmer</button>
      </div>
    </div>
  </div>

  <!-- Toast notifications -->
  <div id="toast-container"></div>

  <script type="module" src="icons.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Créer style.css avec glassmorphism**

```css
/* === RESET & BASE === */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
  background: linear-gradient(135deg, #0f111a 0%, #1a1d2e 100%);
  color: #ffffff;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

/* === WORKSPACE === */
#workspace {
  width: 100%;
  height: calc(100vh - 80px); /* Toolbar height */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
}

/* === CANVAS A4 === */
#preview {
  background: #ffffff;
  box-shadow: 
    0 20px 60px rgba(0,0,0,0.4),
    0 0 0 1px rgba(255,255,255,0.1);
  border-radius: 4px;
  max-width: 100%;
  max-height: 100%;
  touch-action: none; /* Empêche scroll natif sur canvas */
}

/* === TOOLBAR PRINCIPALE === */
#toolbar-main {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  height: 80px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(255,255,255,0.12);
  border-top: 1px solid rgba(255,255,255,0.18);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
}

.toolbar-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* === BOUTONS OUTILS === */
.tool-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s, background 0.12s, opacity 0.12s;
  touch-action: manipulation;
}

.tool-btn:active {
  transform: scale(0.92);
  opacity: 0.7;
}

.tool-btn.active {
  background: rgba(255,255,255,0.2);
  box-shadow: 0 0 0 2px rgba(59,130,246,0.5);
}

.tool-btn svg {
  width: 22px;
  height: 22px;
  stroke-width: 1.75;
}

/* === MODAL === */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
}

.modal-content {
  max-width: 320px;
  padding: 24px;
  text-align: center;
}

.modal-buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: center;
}

.modal-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: rgba(255,255,255,0.1);
  color: #fff;
  transition: transform 0.12s, opacity 0.12s;
}

.modal-btn:active {
  transform: scale(0.95);
}

.modal-btn.primary {
  background: rgba(59,130,246,0.8);
}

/* === TOAST === */
#toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 300;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  padding: 12px 20px;
  border-radius: 12px;
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  font-size: 14px;
  animation: toast-in 0.3s ease;
}

.toast.success { border-left: 3px solid #22c55e; }
.toast.error { border-left: 3px solid #ef4444; }
.toast.info { border-left: 3px solid #3b82f6; }

@keyframes toast-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* === RESPONSIVE === */
@media (min-width: 768px) {
  #workspace {
    padding: 32px;
  }
  
  #toolbar-main {
    height: 72px;
    padding: 8px 32px;
    border-radius: 16px 16px 0 0;
  }
  
  .tool-btn {
    width: 44px;
    height: 44px;
  }
}

/* === CROP OVERLAY === */
#crop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 50;
}

/* === SELECTION UI === */
.selection-handles {
  position: absolute;
  pointer-events: none;
}
```

- [ ] **Step 3: Vérifier que la page s'affiche correctement**

Ouvrir `index.html` dans Chrome DevTools (mode mobile). Vérifier :
- Fond dégradé sombre visible
- Toolbar glassmorphism en bas
- Zone workspace vide (pas encore de canvas)

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: add HTML structure and glassmorphism CSS"
```

---

## Task 2: Système d'Icônes Centralisé (icons.js)

**Files:**
- Create: `icons.js`

**Interfaces:**
- Produit : objet `ICONS` avec mapping nom → SVG Lucide
- Consommé par : `app.js` (injection dans les boutons)

- [ ] **Step 1: Créer icons.js avec mapping Lucide**

```javascript
// icons.js — Mapping centralisé des icônes Lucide
// Chaque icône est un SVG inline avec stroke-width: 1.75
// Pour remplacer par tes propres icônes : modifie les chaînes SVG ci-dessous

export const ICONS = {
  'image-plus': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  
  'rectangle-vertical': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/></svg>`,
  
  'rectangle-horizontal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/></svg>`,
  
  'crop': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>`,
  
  'trash-2': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  
  'bring-to-front': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2" ry="2"/><path d="M3 16V8a2 2 0 0 1 2-2h8"/></svg>`,
  
  'send-to-back': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="13" height="13" rx="2" ry="2"/><path d="M21 16V8a2 2 0 0 0-2-2h-8"/></svg>`,
  
  'download': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  
  'check': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  
  'x': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  
  'move': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
  
  'maximize': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`,
};

// Fonction utilitaire : obtenir une icône HTML
export function getIcon(name) {
  return ICONS[name] || '';
}
```

- [ ] **Step 2: Tester l'import dans un script module**

Ajouter temporairement dans `app.js` (sera supprimé à la tâche suivante) :
```javascript
import { ICONS, getIcon } from './icons.js';
console.log('ICONS chargées :', Object.keys(ICONS));
console.log('image-plus :', ICONS['image-plus']);
```

Ouvrir la console Chrome → vérifier les logs.

- [ ] **Step 3: Commit**

```bash
git add icons.js
git commit -m "feat: add centralized icon mapping (Lucide)"
```

---

## Task 3: Initialisation Canvas A4 & Preview

**Files:**
- Create: `app.js`
- Modify: `index.html:4` (ajout canvas A4 interne)

**Interfaces:**
- Produit : canvas hi-res 300 DPI + canvas preview, state.orientation
- Consommé par : Task 4 (layers), Task 7 (export)

- [ ] **Step 1: Créer app.js avec structure modulaire et Canvas setup**

```javascript
// app.js — Application A4 Composer
// Structure modulaire : chaque section est un bloc commenté
// Pas de framework, vanilla JS, 100% client-side

import { ICONS, getIcon } from './icons.js';

// ========================================
// 1. CONSTANTES
// ========================================

const DPI = 300;
const MM_TO_PX = DPI / 25.4; // Conversion mm → px à 300 DPI

const ORIENTATIONS = {
  portrait: { w: 210, h: 297 },  // mm
  landscape: { w: 297, h: 210 }, // mm
};

// ========================================
// 2. STATE (état global)
// ========================================

const state = {
  orientation: 'portrait',
  hiRes: { w: 0, h: 0 },        // Calculé selon orientation
  fitRatio: 0.35,                 // previewW / hiResW
  canvasOffset: { x: 0, y: 0 },  // Position du canvas preview dans le viewport
  layers: [],                     // Tableau de Layer[]
  selectedLayerId: null,
  cropMode: false,
  cropLayerId: null,
  nextZIndex: 0,                  // Incrémental pour z-index
};

// ========================================
// 3. CANVAS SETUP
// ========================================

// Canvas hi-res (offscreen, non affiché)
const hiResCanvas = document.createElement('canvas');
const hiResCtx = hiResCanvas.getContext('2d');

// Canvas preview (affiché dans le DOM)
const previewCanvas = document.getElementById('preview');
const previewCtx = previewCanvas.getContext('2d');

// Calculer les dimensions hi-res selon l'orientation
function calculateHiRes() {
  const orient = ORIENTATIONS[state.orientation];
  state.hiRes.w = Math.round(orient.w * MM_TO_PX);
  state.hiRes.h = Math.round(orient.h * MM_TO_PX);
  hiResCanvas.width = state.hiRes.w;
  hiResCanvas.height = state.hiRes.h;
}

// Ajuster la taille du canvas preview pour tenir dans l'écran
function fitPreviewToScreen() {
  const workspace = document.getElementById('workspace');
  const maxW = workspace.clientWidth - 32; // padding 16px chaque côté
  const maxH = workspace.clientHeight - 32;
  
  const ratioW = maxW / state.hiRes.w;
  const ratioH = maxH / state.hiRes.h;
  state.fitRatio = Math.min(ratioW, ratioH);
  
  previewCanvas.width = Math.round(state.hiRes.w * state.fitRatio);
  previewCanvas.height = Math.round(state.hiRes.h * state.fitRatio);
  
  // Calculer offset pour centrer
  state.canvasOffset.x = (workspace.clientWidth - previewCanvas.width) / 2;
  state.canvasOffset.y = (workspace.clientHeight - previewCanvas.height) / 2;
  previewCanvas.style.marginLeft = state.canvasOffset.x + 'px';
  previewCanvas.style.marginTop = state.canvasOffset.y + 'px';
}

// ========================================
// 4. RENDER (boucle de rendu)
// ========================================

function render() {
  // 1. Clear canvas hi-res + fond blanc
  hiResCtx.fillStyle = '#ffffff';
  hiResCtx.fillRect(0, 0, state.hiRes.w, state.hiRes.h);
  
  // 2. Dessiner calques triés par zIndex
  state.layers
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(layer => drawLayer(hiResCtx, layer));
  
  // 3. Downsampler vers preview
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.drawImage(hiResCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
  
  // 4. Dessiner UI sélection (poignées, bordure) sur preview uniquement
  if (state.selectedLayerId && !state.cropMode) {
    const layer = getLayerById(state.selectedLayerId);
    if (layer) drawSelectionUI(previewCtx, layer);
  }
}

function drawLayer(ctx, layer) {
  const sx = layer.crop?.x ?? 0;
  const sy = layer.crop?.y ?? 0;
  const sw = layer.crop?.w ?? layer.naturalW;
  const sh = layer.crop?.h ?? layer.naturalH;
  
  ctx.drawImage(layer.img, sx, sy, sw, sh, layer.x, layer.y, layer.w, layer.h);
}

function drawSelectionUI(ctx, layer) {
  const x = layer.x * state.fitRatio;
  const y = layer.y * state.fitRatio;
  const w = layer.w * state.fitRatio;
  const h = layer.h * state.fitRatio;
  
  // Bordure de sélection
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  
  // Poignées aux 4 coins
  const handleSize = 10;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  
  const handles = [
    { x: x, y: y },                    // haut-gauche
    { x: x + w, y: y },                // haut-droite
    { x: x, y: y + h },                // bas-gauche
    { x: x + w, y: y + h },            // bas-droite
  ];
  
  handles.forEach(h => {
    ctx.beginPath();
    ctx.arc(h.x, h.y, handleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

// ========================================
// 5. UTILITAIRES
// ========================================

function getLayerById(id) {
  return state.layers.find(l => l.id === id);
}

function generateId() {
  return 'layer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ========================================
// 6. INITIALISATION
// ========================================

function init() {
  calculateHiRes();
  fitPreviewToScreen();
  render();
  
  // Écouter resize pour recalculer le preview
  window.addEventListener('resize', () => {
    fitPreviewToScreen();
    render();
  });
  
  console.log('A4 Composer initialisé — Canvas hi-res:', state.hiRes.w + 'x' + state.hiRes.h);
}

// Lancer au chargement
document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 2: Vérifier que le canvas s'affiche**

Ouvrir `index.html` dans Chrome DevTools (mode mobile). Vérifier :
- Canvas blanc (feuille A4) centré dans la zone workspace
- Bordure subtile + ombre portée
- Pas d'erreurs console

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add canvas A4 setup with preview and render loop"
```

---

## Task 4: Import d'Images & Gestion des Calques

**Files:**
- Modify: `app.js` (ajout sections Layers, Import)

**Interfaces:**
- Consommé par : Task 5 (interactions), Task 7 (export)
- Produit : `addLayer()`, `removeLayer()`, `getLayerById()`

- [ ] **Step 1: Ajouter le code d'import et gestion des calques dans app.js**

Insérer avant la section `// === 6. INITIALISATION ===` :

```javascript
// ========================================
// 6. LAYERS (gestion des calques)
// ========================================

function addLayer(img) {
  const layer = {
    id: generateId(),
    img: img,
    naturalW: img.naturalWidth,
    naturalH: img.naturalHeight,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    zIndex: state.nextZIndex++,
    crop: null,
  };
  
  // Calculer taille initiale : max 80% de la dimension la plus petite
  const maxDim = Math.min(state.hiRes.w, state.hiRes.h) * 0.8;
  const ratio = Math.min(maxDim / layer.naturalW, maxDim / layer.naturalH);
  layer.w = Math.round(layer.naturalW * ratio);
  layer.h = Math.round(layer.naturalH * ratio);
  
  // Centrer sur la feuille
  layer.x = Math.round((state.hiRes.w - layer.w) / 2);
  layer.y = Math.round((state.hiRes.h - layer.h) / 2);
  
  state.layers.push(layer);
  state.selectedLayerId = layer.id;
  
  updateContextToolbar();
  render();
  showToast('Image ajoutée', 'success');
  return layer;
}

function removeLayer(id) {
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx === -1) return;
  
  state.layers.splice(idx, 1);
  
  if (state.selectedLayerId === id) {
    state.selectedLayerId = null;
  }
  
  updateContextToolbar();
  render();
  showToast('Image supprimée', 'info');
}

function bringToFront(id) {
  const layer = getLayerById(id);
  if (!layer) return;
  
  const maxZ = Math.max(...state.layers.map(l => l.zIndex));
  layer.zIndex = maxZ + 1;
  render();
}

function sendToBack(id) {
  const layer = getLayerById(id);
  if (!layer) return;
  
  const minZ = Math.min(...state.layers.map(l => l.zIndex));
  layer.zIndex = minZ - 1;
  render();
}

// ========================================
// 7. IMPORT (sélection de fichiers)
// ========================================

function handleImport(files) {
  if (!files || files.length === 0) return;
  
  Array.from(files).forEach(file => {
    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      showToast(`"${file.name}" n'est pas une image`, 'error');
      return;
    }
    
    // Limite taille (50 MB)
    if (file.size > 50 * 1024 * 1024) {
      showToast(`"${file.name}" est trop volumineux (> 50 MB)`, 'error');
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      addLayer(img);
      URL.revokeObjectURL(img.src); // Libérer mémoire
    };
    img.onerror = () => {
      showToast(`Erreur lors du chargement de "${file.name}"`, 'error');
    };
    img.src = URL.createObjectURL(file);
  });
}

// ========================================
// 8. TOOLBAR & UI UPDATES
// ========================================

function updateContextToolbar() {
  const groupContext = document.getElementById('group-context');
  if (state.selectedLayerId) {
    groupContext.style.display = 'flex';
  } else {
    groupContext.style.display = 'none';
  }
}
```

- [ ] **Step 2: Brancher le bouton Import et input file**

Remplacer la section `// === 6. INITIALISATION ===` par :

```javascript
// ========================================
// 9. EVENT LISTENERS
// ========================================

function setupEventListeners() {
  // Import
  const btnImport = document.getElementById('btn-import');
  const importInput = document.getElementById('import-input');
  
  btnImport.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    handleImport(e.target.files);
    importInput.value = ''; // Reset pour re-importer le même fichier
  });
  
  // Supprimer
  document.getElementById('btn-delete').addEventListener('click', () => {
    if (state.selectedLayerId) {
      removeLayer(state.selectedLayerId);
    }
  });
  
  // Premier plan / Arrière-plan
  document.getElementById('btn-front').addEventListener('click', () => {
    if (state.selectedLayerId) bringToFront(state.selectedLayerId);
  });
  
  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.selectedLayerId) sendToBack(state.selectedLayerId);
  });
}

// ========================================
// 10. INITIALISATION
// ========================================

function init() {
  calculateHiRes();
  fitPreviewToScreen();
  setupEventListeners();
  
  // Injecter les icônes dans les boutons
  document.getElementById('btn-import').innerHTML = ICONS['image-plus'];
  document.getElementById('btn-portrait').innerHTML = ICONS['rectangle-vertical'];
  document.getElementById('btn-landscape').innerHTML = ICONS['rectangle-horizontal'];
  document.getElementById('btn-crop').innerHTML = ICONS['crop'];
  document.getElementById('btn-delete').innerHTML = ICONS['trash-2'];
  document.getElementById('btn-front').innerHTML = ICONS['bring-to-front'];
  document.getElementById('btn-back').innerHTML = ICONS['send-to-back'];
  document.getElementById('btn-export').innerHTML = ICONS['download'];
  
  render();
  
  window.addEventListener('resize', () => {
    fitPreviewToScreen();
    render();
  });
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 3: Tester l'import d'image**

1. Cliquer sur le bouton Import (icône image-plus)
2. Sélectionner une image dans la galerie
3. Vérifier que l'image apparaît centrée sur la feuille A4
4. Vérifier que la toolbar contextuelle apparaît (crop, delete, front, back)
5. Tester avec plusieurs images (vérifier z-index)

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add image import, layer management, context toolbar"
```

---

## Task 5: Interactions Tactiles (Drag & Resize)

**Files:**
- Modify: `app.js` (ajout section Interactions)

**Interfaces:**
- Consommé par : UI (touch events)
- Produit : `onPointerDown()`, `onPointerMove()`, `onPointerUp()`

- [ ] **Step 1: Ajouter le code d'interactions dans app.js**

Insérer avant `// === 8. TOOLBAR & UI UPDATES ===` :

```javascript
// ========================================
// 8. INTERACTIONS TACTILES/SOURIS
// ========================================

let dragState = null; // { layerId, offsetX, offsetY, mode: 'move'|'resize' }

function hitTest(x, y) {
  // Teste si le point (en coords hi-res) touche un calque
  // Parcourt les calques du plus au-dessus au plus en dessous (zIndex décroissant)
  const sorted = [...state.layers].sort((a, b) => b.zIndex - a.zIndex);
  
  for (const layer of sorted) {
    if (
      x >= layer.x && x <= layer.x + layer.w &&
      y >= layer.y && y <= layer.y + layer.h
    ) {
      return layer.id;
    }
  }
  return null;
}

function isOnResizeHandle(x, y, layer) {
  // Vérifie si le point est sur une poignée de redimensionnement
  const handleRadius = 20 / state.fitRatio; // 20px en coords preview → hi-res
  const handles = [
    { x: layer.x, y: layer.y },                    // haut-gauche
    { x: layer.x + layer.w, y: layer.y },           // haut-droite
    { x: layer.x, y: layer.y + layer.h },           // bas-gauche
    { x: layer.x + layer.w, y: layer.y + layer.h }, // bas-droite
  ];
  
  for (const h of handles) {
    const dist = Math.sqrt((x - h.x) ** 2 + (y - h.y) ** 2);
    if (dist <= handleRadius) return true;
  }
  return false;
}

function getResizeAnchor(handleIndex, layer) {
  // Retourne le coin opposé (anchor) pour le redimensionnement
  const anchors = [
    { x: layer.x + layer.w, y: layer.y + layer.h }, // handle haut-gauche → anchor bas-droite
    { x: layer.x, y: layer.y + layer.h },             // handle haut-droite → anchor bas-gauche
    { x: layer.x + layer.w, y: layer.y },             // handle bas-gauche → anchor haut-droite
    { x: layer.x, y: layer.y },                       // handle bas-droite → anchor haut-gauche
  ];
  return anchors[handleIndex];
}

function onPointerDown(e) {
  if (state.cropMode) return; // Ignorer en mode crop
  
  const point = getPointerCoords(e);
  const hitId = hitTest(point.x, point.y);
  
  if (hitId) {
    // Sélectionner le calque
    state.selectedLayerId = hitId;
    updateContextToolbar();
    
    const layer = getLayerById(hitId);
    
    // Vérifier si on touche une poignée de resize
    if (isOnResizeHandle(point.x, point.y, layer)) {
      // Trouver quelle poignée
      const handles = [
        { x: layer.x, y: layer.y },
        { x: layer.x + layer.w, y: layer.y },
        { x: layer.x, y: layer.y + layer.h },
        { x: layer.x + layer.w, y: layer.y + layer.h },
      ];
      let handleIdx = 0;
      let minDist = Infinity;
      handles.forEach((h, i) => {
        const dist = Math.sqrt((point.x - h.x) ** 2 + (point.y - h.y) ** 2);
        if (dist < minDist) { minDist = dist; handleIdx = i; }
      });
      
      const anchor = getResizeAnchor(handleIdx, layer);
      dragState = {
        layerId: hitId,
        mode: 'resize',
        anchorX: anchor.x,
        anchorY: anchor.y,
        startW: layer.w,
        startH: layer.h,
        startX: layer.x,
        startY: layer.y,
      };
    } else {
      // Mode déplacement
      dragState = {
        layerId: hitId,
        mode: 'move',
        offsetX: point.x - layer.x,
        offsetY: point.y - layer.y,
      };
    }
    
    render();
  } else {
    // Tap sur le fond → désélectionner
    state.selectedLayerId = null;
    updateContextToolbar();
    render();
  }
}

function onPointerMove(e) {
  if (!dragState) return;
  
  const point = getPointerCoords(e);
  const layer = getLayerById(dragState.layerId);
  if (!layer) return;
  
  if (dragState.mode === 'move') {
    layer.x = point.x - dragState.offsetX;
    layer.y = point.y - dragState.offsetY;
    
    // Contrainte : calque ne sort pas complètement de la feuille
    layer.x = Math.max(-layer.w + 50, Math.min(state.hiRes.w - 50, layer.x));
    layer.y = Math.max(-layer.h + 50, Math.min(state.hiRes.h - 50, layer.y));
    
  } else if (dragState.mode === 'resize') {
    // Calculer nouvelle taille depuis l'anchor
    const dx = point.x - dragState.anchorX;
    const dy = point.y - dragState.anchorY;
    
    // Ratio conservé (par défaut)
    const aspectRatio = dragState.startW / dragState.startH;
    let newW = Math.abs(dx);
    let newH = Math.abs(dy);
    
    // Ajuster pour garder le ratio
    if (newW / newH > aspectRatio) {
      newW = newH * aspectRatio;
    } else {
      newH = newW / aspectRatio;
    }
    
    // Taille minimale
    newW = Math.max(50, newW);
    newH = Math.max(50, newH);
    
    // Recalculer position depuis l'anchor
    layer.w = Math.round(newW);
    layer.h = Math.round(newH);
    layer.x = Math.round(dragState.anchorX < point.x ? dragState.anchorX : dragState.anchorX - newW);
    layer.y = Math.round(dragState.anchorY < point.y ? dragState.anchorY : dragState.anchorY - newH);
  }
  
  render();
}

function onPointerUp(e) {
  dragState = null;
}

function getPointerCoords(e) {
  const touch = e.touches?.[0] ?? e;
  const rect = previewCanvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) / state.fitRatio,
    y: (touch.clientY - rect.top) / state.fitRatio,
  };
}

function setupInteractions() {
  // Pointer events sur le canvas preview
  previewCanvas.addEventListener('pointerdown', onPointerDown);
  previewCanvas.addEventListener('pointermove', onPointerMove);
  previewCanvas.addEventListener('pointerup', onPointerUp);
  previewCanvas.addEventListener('pointerleave', onPointerUp);
  
  // Empêcher le scroll natif sur le canvas
  previewCanvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}
```

- [ ] **Step 2: Appeler setupInteractions() dans init()**

Ajouter `setupInteractions();` dans la fonction `init()`.

- [ ] **Step 3: Tester drag & resize**

1. Importer une image
2. La sélectionner (tap dessus) → bordure bleue + poignées
3. Drag → l'image suit le doigt
4. Drag depuis une poignée coin → redimensionnement avec ratio conservé
5. Tap sur le fond → désélection

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add touch/mouse drag and resize interactions"
```

---

## Task 6: Mode Recadrage (Crop)

**Files:**
- Modify: `app.js` (ajout section Crop Mode)

**Interfaces:**
- Consommé par : UI (bouton crop)
- Produit : `enterCropMode()`, `exitCropMode()`

- [ ] **Step 1: Ajouter le code du mode crop dans app.js**

Insérer avant `// === 8. INTERACTIONS TACTILES/SOURIS ===` :

```javascript
// ========================================
// 7. MODE RECADRAGE (CROP)
// ========================================

let cropState = null; // { layerId, startX, startY, origCrop }

function enterCropMode(layerId) {
  const layer = getLayerById(layerId);
  if (!layer) return;
  
  state.cropMode = true;
  state.cropLayerId = layerId;
  
  // Stocker le crop original pour annulation
  cropState = {
    layerId: layerId,
    origCrop: layer.crop ? { ...layer.crop } : null,
  };
  
  // Afficher boutons valider/annuler dans la toolbar contextuelle
  document.getElementById('group-context').style.display = 'none';
  document.getElementById('group-crop').style.display = 'flex';
  
  renderCropUI();
  showToast('Mode recadrage : déplacez les poignées', 'info');
}

function exitCropMode(save = true) {
  if (!save && cropState) {
    // Annuler : restaurer le crop original
    const layer = getLayerById(cropState.layerId);
    if (layer) {
      layer.crop = cropState.origCrop;
    }
  }
  
  state.cropMode = false;
  state.cropLayerId = null;
  cropState = null;
  
  // Restaurer toolbar contextuelle
  document.getElementById('group-crop').style.display = 'none';
  document.getElementById('group-context').style.display = 'flex';
  
  render();
}

function renderCropUI() {
  // Dessiner overlay semi-transparent + poignées de crop
  const layer = getLayerById(state.cropLayerId);
  if (!layer) return;
  
  // Coordonnées crop en preview
  const cropX = (layer.crop?.x ?? 0) * state.fitRatio;
  const cropY = (layer.crop?.y ?? 0) * state.fitRatio;
  const cropW = (layer.crop?.w ?? layer.naturalW) * state.fitRatio;
  const cropH = (layer.crop?.h ?? layer.naturalH) * state.fitRatio;
  
  // Overlay noir semi-transparent
  previewCtx.fillStyle = 'rgba(0,0,0,0.5)';
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // Zone de crop claire
  previewCtx.clearRect(cropX, cropY, cropW, cropH);
  
  // Redessiner l'image dans la zone de crop
  previewCtx.save();
  previewCtx.beginPath();
  previewCtx.rect(cropX, cropY, cropW, cropH);
  previewCtx.clip();
  previewCtx.drawImage(
    layer.img,
    layer.crop?.x ?? 0, layer.crop?.y ?? 0,
    layer.crop?.w ?? layer.naturalW, layer.crop?.h ?? layer.naturalH,
    layer.x * state.fitRatio, layer.y * state.fitRatio,
    layer.w * state.fitRatio, layer.h * state.fitRatio
  );
  previewCtx.restore();
  
  // Bordure de crop
  previewCtx.strokeStyle = '#ffffff';
  previewCtx.lineWidth = 2;
  previewCtx.strokeRect(cropX, cropY, cropW, cropH);
  
  // Poignées de crop (8 : 4 coins + 4 côtés)
  const handleSize = 8;
  previewCtx.fillStyle = '#ffffff';
  previewCtx.strokeStyle = '#3b82f6';
  previewCtx.lineWidth = 2;
  
  const cropHandles = [
    { x: cropX, y: cropY },                       // haut-gauche
    { x: cropX + cropW / 2, y: cropY },           // haut-centre
    { x: cropX + cropW, y: cropY },               // haut-droite
    { x: cropX + cropW, y: cropY + cropH / 2 },  // droite-centre
    { x: cropX + cropW, y: cropY + cropH },       // bas-droite
    { x: cropX + cropW / 2, y: cropY + cropH },  // bas-centre
    { x: cropX, y: cropY + cropH },               // bas-gauche
    { x: cropX, y: cropY + cropH / 2 },           // gauche-centre
  ];
  
  cropHandles.forEach(h => {
    previewCtx.beginPath();
    previewCtx.arc(h.x, h.y, handleSize, 0, Math.PI * 2);
    previewCtx.fill();
    previewCtx.stroke();
  });
}
```

- [ ] **Step 2: Ajouter les boutons Valider/Annuler dans HTML**

Dans `index.html`, ajouter un nouveau groupe `group-crop` après `group-context` :

```html
<div class="toolbar-group" id="group-crop" style="display:none;">
  <button id="btn-crop-cancel" class="tool-btn" title="Annuler">
    <!-- Icône x -->
  </button>
  <button id="btn-crop-ok" class="tool-btn primary" title="Valider">
    <!-- Icône check -->
  </button>
</div>
```

- [ ] **Step 3: Brancher les boutons dans setupEventListeners()**

```javascript
// Crop
document.getElementById('btn-crop').addEventListener('click', () => {
  if (state.selectedLayerId) enterCropMode(state.selectedLayerId);
});

document.getElementById('btn-crop-ok').addEventListener('click', () => exitCropMode(true));
document.getElementById('btn-crop-cancel').addEventListener('click', () => exitCropMode(false));
```

- [ ] **Step 4: Tester le mode crop**

1. Sélectionner une image
2. Cliquer sur le bouton Crop
3. Vérifier : overlay noir, zone claire, poignées blanches
4. Redimensionner la zone de crop avec les poignées
5. Valider → le crop est appliqué
6. Annuler → le crop original est restauré

- [ ] **Step 5: Commit**

```bash
git add app.js index.html
git commit -m "feat: add crop mode with validation and cancel"
```

---

## Task 7: Changement d'Orientation A4

**Files:**
- Modify: `app.js` (ajout section Orientation)

**Interfaces:**
- Consommé par : UI (boutons orientation)
- Produit : `setOrientation()`, `reflowLayers()`

- [ ] **Step 1: Ajouter le code de gestion d'orientation dans app.js**

Insérer avant `// === 7. IMPORT (sélection de fichiers) ===` :

```javascript
// ========================================
// 7. ORIENTATION (Portrait ↔ Paysage)
// ========================================

function setOrientation(orient, skipConfirm = false) {
  if (orient === state.orientation) return;
  
  // Si des calques existent, demander confirmation
  if (!skipConfirm && state.layers.length > 0) {
    showModal(
      'Changer l\'orientation va réorganiser les images. Continuer ?',
      () => {
        applyOrientation(orient);
        reflowLayers();
      }
    );
    return;
  }
  
  applyOrientation(orient);
  reflowLayers();
}

function applyOrientation(orient) {
  state.orientation = orient;
  
  // Mettre à jour les boutons actifs
  document.getElementById('btn-portrait').classList.toggle('active', orient === 'portrait');
  document.getElementById('btn-landscape').classList.toggle('active', orient === 'landscape');
  
  // Recalculer canvas hi-res
  calculateHiRes();
  fitPreviewToScreen();
  
  showToast(`Orientation : ${orient === 'portrait' ? 'Portrait' : 'Paysage'}`, 'info');
}

function reflowLayers() {
  // Réajuster chaque calque pour tenir dans la nouvelle feuille
  state.layers.forEach(layer => {
    // Recalculer taille max (80% de la plus petite dimension)
    const maxDim = Math.min(state.hiRes.w, state.hiRes.h) * 0.8;
    const ratio = Math.min(maxDim / layer.naturalW, maxDim / layer.naturalH);
    layer.w = Math.round(layer.naturalW * ratio);
    layer.h = Math.round(layer.naturalH * ratio);
    
    // Recalculer crop si présent
    if (layer.crop) {
      const cropRatioX = layer.crop.w / layer.naturalW;
      const cropRatioY = layer.crop.h / layer.naturalH;
      layer.crop.w = Math.round(layer.w * cropRatioX);
      layer.crop.h = Math.round(layer.h * cropRatioY);
    }
    
    // Centrer
    layer.x = Math.round((state.hiRes.w - layer.w) / 2);
    layer.y = Math.round((state.hiRes.h - layer.h) / 2);
  });
  
  render();
}

// ========================================
// MODAL (confirmation)
// ========================================

function showModal(message, onConfirm) {
  const modal = document.getElementById('modal-confirm');
  const modalMsg = document.getElementById('modal-message');
  const btnOk = document.getElementById('modal-ok');
  const btnCancel = document.getElementById('modal-cancel');
  
  modalMsg.textContent = message;
  modal.style.display = 'flex';
  
  // Cloner les boutons pour supprimer les anciens event listeners
  const newBtnOk = btnOk.cloneNode(true);
  const newBtnCancel = btnCancel.cloneNode(true);
  btnOk.parentNode.replaceChild(newBtnOk, btnOk);
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  
  newBtnOk.addEventListener('click', () => {
    modal.style.display = 'none';
    if (onConfirm) onConfirm();
  });
  
  newBtnCancel.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}
```

- [ ] **Step 2: Brancher les boutons d'orientation dans setupEventListeners()**

```javascript
// Orientation
document.getElementById('btn-portrait').addEventListener('click', () => setOrientation('portrait'));
document.getElementById('btn-landscape').addEventListener('click', () => setOrientation('landscape'));
```

- [ ] **Step 3: Tester le changement d'orientation**

1. Importer des images
2. Cliquer sur le bouton Paysage
3. Vérifier : modal de confirmation s'affiche
4. Confirmer → canvas passe en paysage, images réajustées
5. Cliquer sur Portrait → retour au portrait

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add orientation switch with confirmation modal"
```

---

## Task 8: Export JPG (300 DPI)

**Files:**
- Modify: `app.js` (ajout section Export)

**Interfaces:**
- Consommé par : UI (bouton export)
- Produit : `exportJPG()`

- [ ] **Step 1: Ajouter le code d'export dans app.js**

Insérer avant `// === 8. INTERACTIONS TACTILES/SOURIS ===` :

```javascript
// ========================================
// 8. EXPORT JPG
// ========================================

function exportJPG() {
  if (state.layers.length === 0) {
    showToast('Aucune image à exporter', 'error');
    return;
  }
  
  showToast('Export en cours...', 'info');
  
  // Créer un canvas temporaire pour l'export
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = state.hiRes.w;
  exportCanvas.height = state.hiRes.h;
  const exportCtx = exportCanvas.getContext('2d');
  
  // Fond blanc
  exportCtx.fillStyle = '#ffffff';
  exportCtx.fillRect(0, 0, state.hiRes.w, state.hiRes.h);
  
  // Dessiner tous les calques triés par zIndex
  state.layers
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(layer => {
      const sx = layer.crop?.x ?? 0;
      const sy = layer.crop?.y ?? 0;
      const sw = layer.crop?.w ?? layer.naturalW;
      const sh = layer.crop?.h ?? layer.naturalH;
      exportCtx.drawImage(layer.img, sx, sy, sw, sh, layer.x, layer.y, layer.w, layer.h);
    });
  
  // Convertir en Blob JPEG
  exportCanvas.toBlob((blob) => {
    if (!blob) {
      showToast('Erreur lors de l\'export', 'error');
      return;
    }
    
    // Générer le nom de fichier
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `composition-A4-${dateStr}-${timeStr}.jpg`;
    
    // Télécharger
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Exporté : ${filename}`, 'success');
  }, 'image/jpeg', 0.92);
}
```

- [ ] **Step 2: Ajouter le bouton d'export dans setupEventListeners()**

```javascript
// Export
document.getElementById('btn-export').addEventListener('click', exportJPG);
```

- [ ] **Step 3: Tester l'export**

1. Importer des images
2. Disposer sur la feuille
3. Cliquer sur le bouton Export (icône download)
4. Vérifier : un fichier JPG est téléchargé
5. Ouvrir le fichier → vérifier la qualité (300 DPI, bon rendu)

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add JPG export (300 DPI, quality 0.92)"
```

---

## Task 9: PWA (Manifest + Service Worker)

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Modify: `index.html` (ajout PWA meta tags)

**Interfaces:**
- Consommé par : navigateur (PWA install prompt)
- Produit : PWA installable, offline-first

- [ ] **Step 1: Créer manifest.json**

```json
{
  "name": "A4 Composer",
  "short_name": "A4 Composer",
  "description": "Composer des images sur feuille A4 pour impression",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#0f111a",
  "theme_color": "#1a1d2e",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Créer sw.js (Service Worker)**

```javascript
// sw.js — Service Worker pour A4 Composer
// Stratégie : cache-first pour les assets statiques

const CACHE_NAME = 'a4-composer-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/icons.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

// Install : pré-cache des assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate : nettoyage anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch : cache-first pour les assets, network-first pour la navigation
self.addEventListener('fetch', (event) => {
  // Si c'est une requête de navigation (page load)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // Pour les autres requêtes : cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(fetchResponse => {
          // Mettre en cache les nouvelles requêtes
          if (fetchResponse.ok) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return fetchResponse;
        });
      })
  );
});
```

- [ ] **Step 3: Ajouter les meta tags PWA dans index.html**

Ajouter dans `<head>` :

```html
<meta name="theme-color" content="#0f111a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

- [ ] **Step 4: Ajouter l'enregistrement du SW dans app.js**

Dans la fonction `init()` :

```javascript
// Enregistrer le Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW enregistré:', reg.scope))
    .catch(err => console.error('Erreur SW:', err));
}
```

- [ ] **Step 5: Créer les icônes PWA (placeholders)**

Utiliser un générateur d'icônes ou créer des images simples 192x192 et 512x512 PNG avec le nom "A4C" ou un logo simple.

Placer dans `icons/` :
- `icon-192.png`
- `icon-512.png`
- `maskable-512.png`

- [ ] **Step 6: Tester la PWA**

1. Ouvrir Chrome DevTools → Application → Manifest
2. Vérifier que le manifest est détecté
3. Ouvrir Chrome DevTools → Application → Service Workers
4. Vérifier que le SW est actif
5. Tester l'installation : Menu Chrome → "Installer l'application"
6. Tester l'offline : Mode avion → rafraîchir → l'app fonctionne

- [ ] **Step 7: Commit**

```bash
git add manifest.json sw.js index.html app.js
git commit -m "feat: add PWA support (manifest + service worker)"
```

---

## Task 10: Polish Final & Tests

**Files:**
- Modify: `app.js` (nettoyage, comments finaux)
- Modify: `style.css` (ajustements responsive)

**Interfaces:**
- Tests finaux de toutes les fonctionnalités

- [ ] **Step 1: Vérifier la structure modulaire du code**

S'assurer que `app.js` suit la structure modulaire :
1. IMPORTS & CONSTANTES
2. STATE
3. CANVAS SETUP
4. RENDER
5. UTILITAIRES
6. LAYERS (gestion calques)
7. ORIENTATION
8. INTERACTIONS TACTILES/SOURIS
9. MODE RECADRAGE (CROP)
10. EXPORT JPG
11. TOOLBAR & UI UPDATES
12. EVENT LISTENERS
13. INITIALISATION

- [ ] **Step 2: Vérifier les commentaires en français**

Chaque section doit avoir des commentaires clairs en français :
```javascript
// ========================================
// NOM DE LA SECTION
// ========================================
```

- [ ] **Step 3: Tests fonctionnels complets**

| Test | Résultat attendu |
|------|------------------|
| Import 1 image | Image centrée, sélectionnée, toolbar contextuelle visible |
| Import 5 images | Z-index correct, toutes visibles |
| Drag 1 calque | Suit le doigt, contrainte aux bords |
| Resize 1 calque | Ratio conservé, taille min 50px |
| Crop | Overlay, poignées, validation/annulation |
| Supprimer | Confirmation, calque supprimé |
| Premier/Arrière-plan | Z-index modifié, rendu correct |
| Orientation Portrait→Paysage | Modal, confirmation, réajustement |
| Export JPG | Fichier téléchargé, qualité 0.92, 300 DPI |
| PWA install | Manifest détecté, installable |
| Offline | Fonctionne sans réseau |

- [ ] **Step 4: Vérifier la responsivité**

Tester sur :
- Mobile (375px width) → toolbar en bas, canvas ajusté
- Tablette (768px) → canvas plus grand
- Desktop (1280px) → layout confortable

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: A4 Composer v1.0 - complete PWA"
```

---

## Récapitulatif des Tâches

| # | Tâche | Fichiers | Estim. |
|---|-------|----------|--------|
| 1 | Structure HTML & CSS | `index.html`, `style.css` | 15 min |
| 2 | Système d'icônes | `icons.js` | 5 min |
| 3 | Canvas A4 & Preview | `app.js` | 20 min |
| 4 | Import & Calques | `app.js` | 25 min |
| 5 | Interactions (Drag/Resize) | `app.js` | 30 min |
| 6 | Mode Crop | `app.js` | 25 min |
| 7 | Changement Orientation | `app.js` | 15 min |
| 8 | Export JPG | `app.js` | 15 min |
| 9 | PWA (Manifest/SW) | `manifest.json`, `sw.js` | 20 min |
| 10 | Polish & Tests | Tous | 20 min |

**Total estimé : ~3h**

---

## Prochaine Étape

Le plan est prêt. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — Je dispatche un subagent par tâche, revue entre chaque tâche, itération rapide

**2. Exécution Inline** — Exécution des tâches dans cette session avec points de contrôle

**Quelle approche ?**
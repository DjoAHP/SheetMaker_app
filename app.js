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
// 10. EXPORTS (pour les autres modules)
// ========================================

export { state, DPI, MM_TO_PX, ORIENTATIONS, generateId, showToast, render, getLayerById, fitPreviewToScreen, calculateHiRes, hiResCanvas, hiResCtx, addLayer, removeLayer };

// ========================================
// 11. INITIALISATION
// ========================================

function init() {
  calculateHiRes();
  fitPreviewToScreen();
  setupEventListeners();
  
  // Injecter les icônes dans les boutons
  document.getElementById('btn-import').innerHTML = getIcon('image-plus');
  document.getElementById('btn-portrait').innerHTML = getIcon('rectangle-vertical');
  document.getElementById('btn-landscape').innerHTML = getIcon('rectangle-horizontal');
  document.getElementById('btn-crop').innerHTML = getIcon('crop');
  document.getElementById('btn-delete').innerHTML = getIcon('trash-2');
  document.getElementById('btn-front').innerHTML = getIcon('bring-to-front');
  document.getElementById('btn-back').innerHTML = getIcon('send-to-back');
  document.getElementById('btn-export').innerHTML = getIcon('download');
  
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

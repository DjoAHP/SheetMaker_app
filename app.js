// app.js — Application A4 Composer
// Structure modulaire : chaque section est un bloc commenté
// Pas de framework, vanilla JS, 100% client-side

import { ICONS, getIcon } from './icons.js';

// ========================================
// 1. IMPORTS & CONSTANTES
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
  hiRes: { w: 0, h: 0 },
  fitRatio: 0.35,
  canvasOffset: { x: 0, y: 0 },
  layers: [],
  selectedLayerId: null,
  cropMode: false,
  cropLayerId: null,
  nextZIndex: 0,
};

// ========================================
// 2b. HISTORY (undo/redo)
// ========================================

const history = {
  undoStack: [],
  redoStack: [],
  maxSteps: 30,
};

function saveState() {
  // Sauvegarder l'état actuel des calques (snapshot profond)
  const snapshot = state.layers.map(l => ({
    ...l,
    crop: l.crop ? { ...l.crop } : null,
  }));
  history.undoStack.push({
    layers: snapshot,
    orientation: state.orientation,
    nextZIndex: state.nextZIndex,
  });
  // Limiter la taille de l'historique
  if (history.undoStack.length > history.maxSteps) {
    history.undoStack.shift();
  }
  // Vider le redo stack quand on fait une nouvelle action
  history.redoStack = [];
}

function undo() {
  if (history.undoStack.length === 0) return;

  // Sauvegarder l'état actuel dans redo
  const currentSnapshot = state.layers.map(l => ({
    ...l,
    crop: l.crop ? { ...l.crop } : null,
  }));
  history.redoStack.push({
    layers: currentSnapshot,
    orientation: state.orientation,
    nextZIndex: state.nextZIndex,
  });

  // Restaurer l'état précédent
  const prev = history.undoStack.pop();
  state.layers = prev.layers;
  state.orientation = prev.orientation;
  state.nextZIndex = prev.nextZIndex;
  state.selectedLayerId = null;

  updateToolbar();
  render();
}

function redo() {
  if (history.redoStack.length === 0) return;

  // Sauvegarder l'état actuel dans undo
  const currentSnapshot = state.layers.map(l => ({
    ...l,
    crop: l.crop ? { ...l.crop } : null,
  }));
  history.undoStack.push({
    layers: currentSnapshot,
    orientation: state.orientation,
    nextZIndex: state.nextZIndex,
  });

  // Restaurer l'état redo
  const next = history.redoStack.pop();
  state.layers = next.layers;
  state.orientation = next.orientation;
  state.nextZIndex = next.nextZIndex;
  state.selectedLayerId = null;

  updateToolbar();
  render();
}

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
  const maxW = workspace.clientWidth - 24; // padding 12px chaque côté
  const maxH = workspace.clientHeight - 24;

  const ratioW = maxW / state.hiRes.w;
  const ratioH = maxH / state.hiRes.h;
  state.fitRatio = Math.min(ratioW, ratioH);

  previewCanvas.width = Math.round(state.hiRes.w * state.fitRatio);
  previewCanvas.height = Math.round(state.hiRes.h * state.fitRatio);

  // Centrer via flexbox (pas de margins, le CSS gère le centrage)
  state.canvasOffset.x = (workspace.clientWidth - previewCanvas.width) / 2;
  state.canvasOffset.y = (workspace.clientHeight - previewCanvas.height) / 2;
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

  // 4. Dessiner UI sur preview uniquement
  if (state.cropMode) {
    renderCropUI();
  } else if (state.selectedLayerId) {
    const layer = getLayerById(state.selectedLayerId);
    if (layer) drawSelectionUI(previewCtx, layer);
  }
}

function drawLayer(ctx, layer) {
  if (layer.type === 'text') {
    ctx.save();
    ctx.font = `${layer.bold ? 'bold ' : ''}${layer.fontSize}px ${layer.fontFamily}`;
    ctx.fillStyle = layer.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(layer.text, layer.x + layer.w / 2, layer.y + layer.h / 2);
    ctx.restore();
  } else {
    const sx = layer.crop?.x ?? 0;
    const sy = layer.crop?.y ?? 0;
    const sw = layer.crop?.w ?? layer.naturalW;
    const sh = layer.crop?.h ?? layer.naturalH;
    ctx.drawImage(layer.img, sx, sy, sw, sh, layer.x, layer.y, layer.w, layer.h);
  }
}

function drawSelectionUI(ctx, layer) {
  const x = layer.x * state.fitRatio;
  const y = layer.y * state.fitRatio;
  const w = layer.w * state.fitRatio;
  const h = layer.h * state.fitRatio;

  // Couleur selon l'état locké
  const color = layer.locked ? '#ef4444' : '#3b82f6';

  // Bordure de sélection
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(layer.locked ? [8, 4] : [6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // Poignées aux 4 coins (seulement si non locké et non texte)
  if (!layer.locked && layer.type !== 'text') {
    const handleSize = 12;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    const handles = [
      { x: x, y: y },                    // haut-gauche
      { x: x + w, y: y },                // haut-droite
      { x: x + w, y: y + h },            // bas-droite
      { x: x, y: y + h },                // bas-gauche
    ];

    handles.forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, handleSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
}

// ========================================
// 5. UTILITAIRES
// ========================================

function getLayerById(id) {
  return state.layers.find(l => l.id === id);
}

function clampLayer(layer) {
  // Borner un calque pour qu'il reste dans le canvas A4
  layer.x = Math.max(0, Math.min(state.hiRes.w - layer.w, layer.x));
  layer.y = Math.max(0, Math.min(state.hiRes.h - layer.h, layer.y));
}

function generateId() {
  return 'layer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function measureText(text, fontFamily, fontSize, bold) {
  hiResCtx.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
  const metrics = hiResCtx.measureText(text);
  return {
    w: Math.ceil(metrics.width) + 20,
    h: Math.ceil(fontSize * 1.6),
  };
}

function showModal(message, onConfirm, cancelLabel = 'Annuler', confirmLabel = 'Confirmer') {
  const modal = document.getElementById('modal-confirm');
  const modalMsg = document.getElementById('modal-message');
  const btnOk = document.getElementById('modal-ok');
  const btnCancel = document.getElementById('modal-cancel');

  modalMsg.textContent = message;
  modal.style.display = 'flex';

  // Cloner les boutons pour supprimer les anciens event listeners
  const newBtnOk = btnOk.cloneNode(true);
  const newBtnCancel = btnCancel.cloneNode(true);
  newBtnCancel.textContent = cancelLabel;
  newBtnOk.textContent = confirmLabel;
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

// ========================================
// 6. LAYERS (gestion des calques)
// ========================================

function addLayer(img) {
  saveState();
  
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
    locked: false,
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

  updateToolbar();
  render();
  return layer;
}

function addTextLayer() {
  saveState();

  const fontFamily = 'Arial';
  const fontSize = 150;
  const bold = false;
  const color = '#000000';
  const text = 'TEXTE ici';

  const { w, h } = measureText(text, fontFamily, fontSize, bold);

  const layer = {
    id: generateId(),
    type: 'text',
    text: text,
    fontFamily: fontFamily,
    fontSize: fontSize,
    bold: bold,
    color: color,
    x: 0,
    y: 0,
    w: w,
    h: h,
    zIndex: state.nextZIndex++,
    locked: false,
  };

  // Centrer sur la feuille
  layer.x = Math.round((state.hiRes.w - layer.w) / 2);
  layer.y = Math.round((state.hiRes.h - layer.h) / 2);

  state.layers.push(layer);
  state.selectedLayerId = layer.id;

  updateToolbar();
  render();
  return layer;
}

function removeLayer(id) {
  saveState();
  
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx === -1) return;

  state.layers.splice(idx, 1);

  if (state.selectedLayerId === id) {
    state.selectedLayerId = null;
  }

  updateToolbar();
  render();
}

function bringToFront(id) {
  saveState();
  
  const layer = getLayerById(id);
  if (!layer) return;

  const maxZ = Math.max(...state.layers.map(l => l.zIndex));
  layer.zIndex = maxZ + 1;
  render();
}

function sendToBack(id) {
  saveState();
  
  const layer = getLayerById(id);
  if (!layer) return;

  const minZ = Math.min(...state.layers.map(l => l.zIndex));
  layer.zIndex = minZ - 1;
  render();
}

function toggleLock(id) {
  saveState();
  
  const layer = getLayerById(id);
  if (!layer) return;

  layer.locked = !layer.locked;
  updateToolbar();
  render();
}

function reflowLayers() {
  // Réajuster chaque calque pour tenir dans la nouvelle feuille
  state.layers.forEach(layer => {
    if (layer.type === 'text') {
      // Recentrer le texte sans changer sa taille
      layer.x = Math.round((state.hiRes.w - layer.w) / 2);
      layer.y = Math.round((state.hiRes.h - layer.h) / 2);
      return;
    }

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
}

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
  // 36px en coords preview → converti en coords hi-res pour le test
  const handleRadius = 36 / state.fitRatio;
  const handles = [
    { x: layer.x, y: layer.y },                    // haut-gauche
    { x: layer.x + layer.w, y: layer.y },           // haut-droite
    { x: layer.x + layer.w, y: layer.y + layer.h }, // bas-droite
    { x: layer.x, y: layer.y + layer.h },           // bas-gauche
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
    { x: layer.x + layer.w, y: layer.y + layer.h }, // 0: haut-gauche → bas-droite
    { x: layer.x, y: layer.y + layer.h },             // 1: haut-droite → bas-gauche
    { x: layer.x, y: layer.y },                       // 2: bas-droite → haut-gauche
    { x: layer.x + layer.w, y: layer.y },             // 3: bas-gauche → haut-droite
  ];
  return anchors[handleIndex];
}

function onPointerDown(e) {
  if (state.cropMode) {
    onCropPointerDown(e);
    return;
  }

  const point = getPointerCoords(e);
  const hitId = hitTest(point.x, point.y);

  if (hitId) {
    const layer = getLayerById(hitId);
    
    // Sélectionner le calque (même s'il est locké)
    state.selectedLayerId = hitId;
    updateToolbar();

    // Si le calque est locké, on ne permet ni drag ni resize
    if (layer && layer.locked) {
      render();
      return;
    }

    // Vérifier si on touche une poignée de resize (pas pour les textes)
    if (layer.type !== 'text' && isOnResizeHandle(point.x, point.y, layer)) {
      saveState();
      // Trouver quelle poignée parmi les 4 coins
      const handles = [
        { x: layer.x, y: layer.y },
        { x: layer.x + layer.w, y: layer.y },
        { x: layer.x + layer.w, y: layer.y + layer.h },
        { x: layer.x, y: layer.y + layer.h },
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
        handleIdx: handleIdx,
        anchorX: anchor.x,
        anchorY: anchor.y,
        startW: layer.w,
        startH: layer.h,
        startX: layer.x,
        startY: layer.y,
      };
    } else {
      // Mode déplacement
      saveState();
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
    updateToolbar();
    render();
  }
}

function onPointerMove(e) {
  if (state.cropMode) {
    onCropPointerMove(e);
    return;
  }
  if (!dragState) {
    // Changer le curseur au survol des poignées
    const point = getPointerCoords(e);
    const hitId = hitTest(point.x, point.y);
    if (hitId) {
      const layer = getLayerById(hitId);
      if (layer && !layer.locked && layer.type !== 'text' && isOnResizeHandle(point.x, point.y, layer)) {
        previewCanvas.style.cursor = 'nwse-resize';
      } else {
        previewCanvas.style.cursor = 'grab';
      }
    } else {
      previewCanvas.style.cursor = 'default';
    }
    return;
  }

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
    newW = Math.max(80, newW);
    newH = Math.max(80, newH);

    // Recalculer position depuis l'anchor
    layer.w = Math.round(newW);
    layer.h = Math.round(newH);
    layer.x = Math.round(dragState.anchorX < point.x ? dragState.anchorX : dragState.anchorX - newW);
    layer.y = Math.round(dragState.anchorY < point.y ? dragState.anchorY : dragState.anchorY - newH);
    
    // Borner pour rester dans le canvas
    clampLayer(layer);
  }

  render();
}

function onPointerUp(e) {
  if (state.cropMode) {
    onCropPointerUp();
    return;
  }
  dragState = null;
}

function getPointerCoords(e) {
  // Gérer touch events (touchend a.changedTouches au lieu de e.touches)
  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  
  const rect = previewCanvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / state.fitRatio,
    y: (clientY - rect.top) / state.fitRatio,
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

  // Cliquer en dehors du canvas déselectionne
  document.getElementById('workspace').addEventListener('pointerdown', (e) => {
    // Si le clic n'est pas sur le canvas, déselectionner
    if (e.target !== previewCanvas && !state.cropMode) {
      state.selectedLayerId = null;
      updateToolbar();
      render();
    }
  });

  // Double-clic pour éditer le texte
  previewCanvas.addEventListener('dblclick', (e) => {
    const point = getPointerCoords(e);
    const hitId = hitTest(point.x, point.y);
    if (!hitId) return;
    const layer = getLayerById(hitId);
    if (!layer || layer.type !== 'text') return;
    openTextEditor(layer);
  });

  // Double-tap mobile (timer-based)
  let lastTapTime = 0;
  let lastTapTarget = null;
  previewCanvas.addEventListener('touchend', (e) => {
    const now = Date.now();
    const point = getPointerCoords(e);
    const hitId = hitTest(point.x, point.y);
    if (now - lastTapTime < 300 && hitId === lastTapTarget) {
      e.preventDefault();
      const layer = getLayerById(hitId);
      if (layer && layer.type === 'text') {
        openTextEditor(layer);
      }
    }
    lastTapTime = now;
    lastTapTarget = hitId;
  });
}

// ========================================
// 9. MODE RECADRAGE (CROP)
// ========================================

let cropState = null; // { layerId, origCrop }
let cropDragState = null; // { handleIndex, origCrop }

function enterCropMode(layerId) {
  saveState();
  
  const layer = getLayerById(layerId);
  if (!layer) return;

  state.cropMode = true;
  state.cropLayerId = layerId;

  cropState = {
    layerId: layerId,
    origCrop: layer.crop ? { ...layer.crop } : null,
  };

  document.getElementById('toolbar-top').style.display = 'none';
  document.getElementById('toolbar-crop').style.display = 'flex';

  previewCanvas.style.cursor = 'crosshair';
  render();
}

function exitCropMode(save = true) {
  if (!save && cropState) {
    const layer = getLayerById(cropState.layerId);
    if (layer) {
      layer.crop = cropState.origCrop;
    }
  } else if (save && cropState) {
    const layer = getLayerById(cropState.layerId);
    if (layer && layer.crop) {
      const cropRatio = layer.crop.w / layer.crop.h;
      const area = layer.w * layer.h;
      
      let newW = Math.round(Math.sqrt(area * cropRatio));
      let newH = Math.round(newW / cropRatio);
      
      // Si l'image dépasse le canvas, la réduire pour tenir dedans
      const maxW = state.hiRes.w * 0.9;
      const maxH = state.hiRes.h * 0.9;
      if (newW > maxW) {
        newW = Math.round(maxW);
        newH = Math.round(newW / cropRatio);
      }
      if (newH > maxH) {
        newH = Math.round(maxH);
        newW = Math.round(newH * cropRatio);
      }
      
      // Recentrer et borner
      layer.x = Math.round(layer.x + (layer.w - newW) / 2);
      layer.y = Math.round(layer.y + (layer.h - newH) / 2);
      layer.w = newW;
      layer.h = newH;
      
      // Borner pour rester dans le canvas
      clampLayer(layer);
    }
  }

  state.cropMode = false;
  state.cropLayerId = null;
  cropState = null;
  cropDragState = null;

  document.getElementById('toolbar-crop').style.display = 'none';
  document.getElementById('toolbar-top').style.display = 'flex';

  previewCanvas.style.cursor = '';
  render();
}

function getSourceCropRect(layer) {
  return layer.crop || { x: 0, y: 0, w: layer.naturalW, h: layer.naturalH };
}

function cropToPreviewCoords(layer) {
  const crop = getSourceCropRect(layer);
  
  // Convertir les coords source → coords preview
  const previewX = layer.x * state.fitRatio;
  const previewY = layer.y * state.fitRatio;
  const previewW = layer.w * state.fitRatio;
  const previewH = layer.h * state.fitRatio;

  // Position du crop dans l'image affichée
  const cropPreviewX = previewX + (crop.x / layer.naturalW) * previewW;
  const cropPreviewY = previewY + (crop.y / layer.naturalH) * previewH;
  const cropPreviewW = (crop.w / layer.naturalW) * previewW;
  const cropPreviewH = (crop.h / layer.naturalH) * previewH;

  return {
    x: cropPreviewX,
    y: cropPreviewY,
    w: cropPreviewW,
    h: cropPreviewH,
  };
}

function getCropHandles(cx, cy, cw, ch) {
  return [
    { x: cx, y: cy },
    { x: cx + cw / 2, y: cy },
    { x: cx + cw, y: cy },
    { x: cx + cw, y: cy + ch / 2 },
    { x: cx + cw, y: cy + ch },
    { x: cx + cw / 2, y: cy + ch },
    { x: cx, y: cy + ch },
    { x: cx, y: cy + ch / 2 },
  ];
}

function hitTestCropHandle(previewX, previewY) {
  const layer = getLayerById(state.cropLayerId);
  if (!layer) return -1;

  const { x: cx, y: cy, w: cw, h: ch } = cropToPreviewCoords(layer);
  const handleRadius = 20; // Plus grand pour mobile
  const handles = getCropHandles(cx, cy, cw, ch);

  for (let i = 0; i < handles.length; i++) {
    const dist = Math.sqrt((previewX - handles[i].x) ** 2 + (previewY - handles[i].y) ** 2);
    if (dist <= handleRadius) return i;
  }
  return -1;
}

function renderCropUI() {
  const layer = getLayerById(state.cropLayerId);
  if (!layer) return;

  const crop = getSourceCropRect(layer);
  const { x: cx, y: cy, w: cw, h: ch } = cropToPreviewCoords(layer);

  // Dessiner l'image à sa taille normale (sans étirer)
  previewCtx.drawImage(
    layer.img,
    0, 0, layer.naturalW, layer.naturalH,
    layer.x * state.fitRatio, layer.y * state.fitRatio,
    layer.w * state.fitRatio, layer.h * state.fitRatio
  );

  // Masque semi-transparent SAUF sur la zone de crop
  previewCtx.fillStyle = 'rgba(0,0,0,0.5)';
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // Effacer le masque sur la zone de crop pour montrer l'image claire
  previewCtx.clearRect(cx, cy, cw, ch);

  // Redessiner l'image dans la zone de crop (pour qu'elle soit claire)
  previewCtx.save();
  previewCtx.beginPath();
  previewCtx.rect(cx, cy, cw, ch);
  previewCtx.clip();
  previewCtx.drawImage(
    layer.img,
    0, 0, layer.naturalW, layer.naturalH,
    layer.x * state.fitRatio, layer.y * state.fitRatio,
    layer.w * state.fitRatio, layer.h * state.fitRatio
  );
  previewCtx.restore();

  // Bordure blanche autour de la zone crop
  previewCtx.strokeStyle = '#ffffff';
  previewCtx.lineWidth = 2;
  previewCtx.strokeRect(cx, cy, cw, ch);

  // Poignées du crop
  const handleSize = 10;
  previewCtx.fillStyle = '#ffffff';
  previewCtx.strokeStyle = '#3b82f6';
  previewCtx.lineWidth = 2;

  getCropHandles(cx, cy, cw, ch).forEach(h => {
    previewCtx.beginPath();
    previewCtx.arc(h.x, h.y, handleSize, 0, Math.PI * 2);
    previewCtx.fill();
    previewCtx.stroke();
  });
}

function onCropPointerDown(e) {
  const previewX = e.clientX - previewCanvas.getBoundingClientRect().left;
  const previewY = e.clientY - previewCanvas.getBoundingClientRect().top;

  const handleIdx = hitTestCropHandle(previewX, previewY);
  if (handleIdx >= 0) {
    const layer = getLayerById(state.cropLayerId);
    cropDragState = {
      handleIndex: handleIdx,
      origCrop: getSourceCropRect(layer),
    };
  }
}

function onCropPointerMove(e) {
  const previewX = e.clientX - previewCanvas.getBoundingClientRect().left;
  const previewY = e.clientY - previewCanvas.getBoundingClientRect().top;

  if (!cropDragState) {
    const handleIdx = hitTestCropHandle(previewX, previewY);
    if (handleIdx >= 0) {
      const cursors = ['nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize',
                       'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize'];
      previewCanvas.style.cursor = cursors[handleIdx];
    } else {
      previewCanvas.style.cursor = 'crosshair';
    }
    return;
  }

  const layer = getLayerById(state.cropLayerId);
  if (!layer) return;

  // Convertir preview → coords source
  const hiResX = previewX / state.fitRatio;
  const hiResY = previewY / state.fitRatio;
  const srcX = ((hiResX - layer.x) / layer.w) * layer.naturalW;
  const srcY = ((hiResY - layer.y) / layer.h) * layer.naturalH;

  const orig = cropDragState.origCrop;
  const handleIdx = cropDragState.handleIndex;

  const affectLeft = [0, 6, 7].includes(handleIdx);
  const affectRight = [2, 3, 4].includes(handleIdx);
  const affectTop = [0, 1, 2].includes(handleIdx);
  const affectBottom = [4, 5, 6].includes(handleIdx);

  let newX = orig.x;
  let newY = orig.y;
  let newW = orig.w;
  let newH = orig.h;

  const MIN_CROP = 20;

  if (affectLeft) {
    newX = Math.max(0, Math.min(orig.x + orig.w - MIN_CROP, srcX));
    newW = orig.x + orig.w - newX;
  }
  if (affectRight) {
    newW = Math.max(MIN_CROP, Math.min(layer.naturalW - orig.x, srcX - orig.x));
  }
  if (affectTop) {
    newY = Math.max(0, Math.min(orig.y + orig.h - MIN_CROP, srcY));
    newH = orig.y + orig.h - newY;
  }
  if (affectBottom) {
    newH = Math.max(MIN_CROP, Math.min(layer.naturalH - orig.y, srcY - orig.y));
  }

  layer.crop = {
    x: Math.round(newX),
    y: Math.round(newY),
    w: Math.round(newW),
    h: Math.round(newH),
  };

  render();
}

function onCropPointerUp() {
  cropDragState = null;
}

// ========================================
// 10. EXPORT JPG (300 DPI)
// ========================================

function exportJPG() {
  if (state.layers.length === 0) {
    return;
  }

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = state.hiRes.w;
  exportCanvas.height = state.hiRes.h;
  const exportCtx = exportCanvas.getContext('2d');

  exportCtx.fillStyle = '#ffffff';
  exportCtx.fillRect(0, 0, state.hiRes.w, state.hiRes.h);

  state.layers
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(layer => {
      const sx = layer.crop?.x ?? 0;
      const sy = layer.crop?.y ?? 0;
      const sw = layer.crop?.w ?? layer.naturalW;
      const sh = layer.crop?.h ?? layer.naturalH;
      exportCtx.drawImage(layer.img, sx, sy, sw, sh, layer.x, layer.y, layer.w, layer.h);
    });

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `composition-A4-${dateStr}-${timeStr}.jpg`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/jpeg', 0.92);
}

// ========================================
// 11. TOOLBAR & UI UPDATES
// ========================================

function updateToolbar() {
  const toolbarTop = document.getElementById('toolbar-top');
  const workspace = document.getElementById('workspace');
  const btnLock = document.getElementById('btn-lock');

  if (state.selectedLayerId) {
    const layer = getLayerById(state.selectedLayerId);
    toolbarTop.style.display = 'flex';
    workspace.classList.add('has-topbar');

    // Mettre à jour l'icône du cadenas
    if (layer) {
      if (layer.locked) {
        btnLock.innerHTML = getIcon('lock');
        btnLock.classList.add('locked');
      } else {
        btnLock.innerHTML = getIcon('lock-open');
        btnLock.classList.remove('locked');
      }
    }
  } else {
    toolbarTop.style.display = 'none';
    workspace.classList.remove('has-topbar');
  }

  // Afficher/masquer la barre texte
  const toolbarText = document.getElementById('toolbar-text');
  if (state.selectedLayerId) {
    const layer = getLayerById(state.selectedLayerId);
    if (layer && layer.type === 'text') {
      toolbarText.style.display = 'flex';
      workspace.classList.add('has-textbar');
      // Mettre à jour les contrôles avec les valeurs du calque
      syncTextToolbar(layer);
    } else {
      toolbarText.style.display = 'none';
      workspace.classList.remove('has-textbar');
    }
  } else {
    toolbarText.style.display = 'none';
    workspace.classList.remove('has-textbar');
  }
}

function syncTextToolbar(layer) {
  document.getElementById('text-font').value = layer.fontFamily;
  document.getElementById('text-size').value = layer.fontSize;
  document.getElementById('text-color').value = layer.color;
  const btnBold = document.getElementById('text-bold');
  btnBold.innerHTML = getIcon('bold');
  btnBold.classList.toggle('active', layer.bold);
}

function recalcTextSize(layer) {
  const { w, h } = measureText(layer.text, layer.fontFamily, layer.fontSize, layer.bold);
  const oldCX = layer.x + layer.w / 2;
  const oldCY = layer.y + layer.h / 2;
  layer.w = w;
  layer.h = h;
  // Garder le centre actuel
  layer.x = Math.round(oldCX - w / 2);
  layer.y = Math.round(oldCY - h / 2);
}

function openTextEditor(layer) {
  const overlay = document.getElementById('text-editor-overlay');
  const preview = document.getElementById('preview');
  const previewRect = preview.getBoundingClientRect();

  // Positionner l'overlay sur la zone du calque dans le preview
  const x = layer.x * state.fitRatio;
  const y = layer.y * state.fitRatio;
  const w = layer.w * state.fitRatio;
  const h = layer.h * state.fitRatio;

  overlay.style.left = (previewRect.left + x) + 'px';
  overlay.style.top = (previewRect.top + y) + 'px';
  overlay.style.width = w + 'px';
  overlay.style.height = h + 'px';
  overlay.style.fontFamily = layer.fontFamily;
  overlay.style.fontSize = Math.round(layer.fontSize * state.fitRatio) + 'px';
  overlay.style.fontWeight = layer.bold ? 'bold' : 'normal';
  overlay.style.color = layer.color;
  overlay.value = layer.text;
  overlay.style.display = 'block';
  overlay.focus();

  // Sélectionner tout le texte
  overlay.select();

  // Nettoyer les anciens écouteurs avant d'en ajouter de nouveaux
  overlay.removeEventListener('blur', closeTextEditor);
  if (overlay._keydownHandler) {
    overlay.removeEventListener('keydown', overlay._keydownHandler);
  }

  // Fermer au blur
  overlay._layerId = layer.id;
  overlay.addEventListener('blur', closeTextEditor);
  overlay._keydownHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      overlay.blur();
    }
    if (e.key === 'Escape') {
      overlay.blur();
    }
  };
  overlay.addEventListener('keydown', overlay._keydownHandler);
}

function closeTextEditor(e) {
  const overlay = document.getElementById('text-editor-overlay');
  overlay.style.display = 'none';

  const layerId = overlay._layerId;
  overlay._layerId = null;
  overlay.removeEventListener('blur', closeTextEditor);
  if (overlay._keydownHandler) {
    overlay.removeEventListener('keydown', overlay._keydownHandler);
    overlay._keydownHandler = null;
  }

  if (!layerId) return;

  const layer = getLayerById(layerId);
  if (!layer || layer.type !== 'text') return;

  const newText = overlay.value.trim();
  if (newText && newText !== layer.text) {
    saveState();
    layer.text = newText;
    recalcTextSize(layer);
    render();
  }
}

// ========================================
// 12. EVENT LISTENERS
// ========================================

function handleImport(files) {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Limite taille (50 MB)
    if (file.size > 50 * 1024 * 1024) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      addLayer(img);
      URL.revokeObjectURL(img.src); // Libérer mémoire
    };
    img.onerror = () => {
    };
    img.src = URL.createObjectURL(file);
  });
}

function setupEventListeners() {
  // Import
  const btnImport = document.getElementById('btn-import');
  const importInput = document.getElementById('import-input');

  btnImport.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    handleImport(e.target.files);
    importInput.value = ''; // Reset pour re-importer le même fichier
  });

  // Supprimer avec confirmation
  document.getElementById('btn-delete').addEventListener('click', () => {
    if (state.selectedLayerId) {
      showModal(
        'Voulez-vous vraiment supprimer cette image ?',
        () => removeLayer(state.selectedLayerId),
        'Annuler',
        'Oui, supprimer'
      );
    }
  });

  // Premier plan / Arrière-plan
  document.getElementById('btn-front').addEventListener('click', () => {
    if (state.selectedLayerId) bringToFront(state.selectedLayerId);
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.selectedLayerId) sendToBack(state.selectedLayerId);
  });

  // Orientation
  document.getElementById('btn-portrait').addEventListener('click', () => setOrientation('portrait'));
  document.getElementById('btn-landscape').addEventListener('click', () => setOrientation('landscape'));

  // Crop
  document.getElementById('btn-crop').addEventListener('click', () => {
    if (state.selectedLayerId) enterCropMode(state.selectedLayerId);
  });

  document.getElementById('btn-crop-ok').addEventListener('click', () => exitCropMode(true));
  document.getElementById('btn-crop-cancel').addEventListener('click', () => exitCropMode(false));

  // Texte — ajouter un calque texte
  document.getElementById('btn-text').addEventListener('click', () => {
    addTextLayer();
  });

  // Contrôles texte — mettre à jour le calque sélectionné
  document.getElementById('text-font').addEventListener('change', (e) => {
    const layer = getLayerById(state.selectedLayerId);
    if (!layer || layer.type !== 'text') return;
    saveState();
    layer.fontFamily = e.target.value;
    recalcTextSize(layer);
    render();
  });

  document.getElementById('text-size').addEventListener('change', (e) => {
    const layer = getLayerById(state.selectedLayerId);
    if (!layer || layer.type !== 'text') return;
    saveState();
    layer.fontSize = Math.max(8, Math.min(500, parseInt(e.target.value, 10) || 150));
    recalcTextSize(layer);
    render();
  });

  document.getElementById('text-bold').addEventListener('click', () => {
    const layer = getLayerById(state.selectedLayerId);
    if (!layer || layer.type !== 'text') return;
    saveState();
    layer.bold = !layer.bold;
    recalcTextSize(layer);
    syncTextToolbar(layer);
    render();
  });

  let colorChangeTimer = null;
  document.getElementById('text-color').addEventListener('input', (e) => {
    const layer = getLayerById(state.selectedLayerId);
    if (!layer || layer.type !== 'text') return;
    layer.color = e.target.value;
    render();
    clearTimeout(colorChangeTimer);
    colorChangeTimer = setTimeout(() => saveState(), 500);
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', exportJPG);

  // Undo/Redo
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // Lock/Unlock
  document.getElementById('btn-lock').addEventListener('click', () => {
    if (state.selectedLayerId) toggleLock(state.selectedLayerId);
  });
}

// ========================================
// 13. INITIALISATION
// ========================================

function init() {
  calculateHiRes();
  fitPreviewToScreen();
  setupEventListeners();
  setupInteractions();

  // Enregistrer le Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW enregistré:', reg.scope))
      .catch(err => console.error('Erreur SW:', err));
  }

  // Initialiser l'état actif des boutons d'orientation
  document.getElementById('btn-portrait').classList.add('active');
  document.getElementById('btn-landscape').classList.remove('active');

  // Injecter les icônes dans les boutons
  document.getElementById('btn-import').innerHTML = getIcon('image-plus');
  document.getElementById('btn-text').innerHTML = getIcon('type');
  document.getElementById('btn-portrait').innerHTML = getIcon('rectangle-vertical');
  document.getElementById('btn-landscape').innerHTML = getIcon('rectangle-horizontal');
  document.getElementById('btn-crop').innerHTML = getIcon('crop');
  document.getElementById('btn-delete').innerHTML = getIcon('trash-2');
  document.getElementById('btn-front').innerHTML = getIcon('bring-to-front');
  document.getElementById('btn-back').innerHTML = getIcon('send-to-back');
  document.getElementById('btn-export').innerHTML = getIcon('download');
  document.getElementById('btn-crop-cancel').innerHTML = getIcon('x');
  document.getElementById('btn-crop-ok').innerHTML = getIcon('check');
  document.getElementById('btn-lock').innerHTML = getIcon('lock-open');
  document.getElementById('btn-undo').innerHTML = getIcon('undo');
  document.getElementById('btn-redo').innerHTML = getIcon('redo');

  render();

  // Écouter resize pour recalculer le preview
  window.addEventListener('resize', () => {
    fitPreviewToScreen();
    render();
  });

  // Raccourcis clavier
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    }
  });

  console.log('A4 Composer initialisé — Canvas hi-res:', state.hiRes.w + 'x' + state.hiRes.h);
}

// Lancer au chargement
document.addEventListener('DOMContentLoaded', init);

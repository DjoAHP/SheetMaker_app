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

  // Couleur selon l'état locké
  const color = layer.locked ? '#ef4444' : '#3b82f6';

  // Bordure de sélection
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(layer.locked ? [8, 4] : [6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // Poignées aux 4 coins (seulement si non locké)
  if (!layer.locked) {
    const handleSize = 10;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    const handles = [
      { x: x, y: y },                    // haut-gauche
      { x: x + w, y: y },                // haut-droite
      { x: x, y: y + h },                // bas-gauche
      { x: x + w, y: h + y },            // bas-droite
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

  updateToolbar();
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

function toggleLock(id) {
  const layer = getLayerById(id);
  if (!layer) return;

  layer.locked = !layer.locked;
  updateNavbar();
  render();
  
  if (layer.locked) {
    showToast('Image bloquée', 'info');
  } else {
    showToast('Image débloquée', 'info');
  }
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
  // 24px en coords preview → converti en coords hi-res pour le test
  const handleRadius = 24 / state.fitRatio;
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
    updateToolbar();
    render();
  }
}

function onPointerMove(e) {
  if (state.cropMode) {
    onCropPointerMove(e);
    return;
  }
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
}

// ========================================
// 9. MODE RECADRAGE (CROP)
// ========================================

let cropState = null; // { layerId, origCrop }
let cropDragState = null; // { handleIndex, origCrop }

function enterCropMode(layerId) {
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
  showToast('Mode recadrage : déplacez les poignées', 'info');
}

function exitCropMode(save = true) {
  if (!save && cropState) {
    const layer = getLayerById(cropState.layerId);
    if (layer) {
      layer.crop = cropState.origCrop;
    }
  } else if (save && cropState) {
    // Mettre à jour les dimensions d'affichage pour correspondre au ratio du crop
    const layer = getLayerById(cropState.layerId);
    if (layer && layer.crop) {
      const cropRatio = layer.crop.w / layer.crop.h;
      // Recalculer w/h pour garder le ratio du crop
      if (layer.w / layer.h > cropRatio) {
        layer.w = Math.round(layer.h * cropRatio);
      } else {
        layer.h = Math.round(layer.w / cropRatio);
      }
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
  const hiResCropX = layer.x + (crop.x / layer.naturalW) * layer.w;
  const hiResCropY = layer.y + (crop.y / layer.naturalH) * layer.h;
  const hiResCropW = (crop.w / layer.naturalW) * layer.w;
  const hiResCropH = (crop.h / layer.naturalH) * layer.h;
  return {
    x: hiResCropX * state.fitRatio,
    y: hiResCropY * state.fitRatio,
    w: hiResCropW * state.fitRatio,
    h: hiResCropH * state.fitRatio,
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
  const handleRadius = 12;
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

  previewCtx.fillStyle = 'rgba(0,0,0,0.5)';
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  previewCtx.save();
  previewCtx.beginPath();
  previewCtx.rect(cx, cy, cw, ch);
  previewCtx.clip();
  previewCtx.drawImage(
    layer.img,
    crop.x, crop.y, crop.w, crop.h,
    layer.x * state.fitRatio, layer.y * state.fitRatio,
    layer.w * state.fitRatio, layer.h * state.fitRatio
  );
  previewCtx.restore();

  previewCtx.strokeStyle = '#ffffff';
  previewCtx.lineWidth = 2;
  previewCtx.strokeRect(cx, cy, cw, ch);

  const handleSize = 8;
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
    showToast('Aucune image à exporter', 'error');
    return;
  }

  showToast('Export en cours...', 'info');

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
      showToast('Erreur lors de l\'export', 'error');
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

    showToast(`Exporté : ${filename}`, 'success');
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
}

// ========================================
// 12. EVENT LISTENERS
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

  // Orientation
  document.getElementById('btn-portrait').addEventListener('click', () => setOrientation('portrait'));
  document.getElementById('btn-landscape').addEventListener('click', () => setOrientation('landscape'));

  // Crop
  document.getElementById('btn-crop').addEventListener('click', () => {
    if (state.selectedLayerId) enterCropMode(state.selectedLayerId);
  });

  document.getElementById('btn-crop-ok').addEventListener('click', () => exitCropMode(true));
  document.getElementById('btn-crop-cancel').addEventListener('click', () => exitCropMode(false));

  // Export
  document.getElementById('btn-export').addEventListener('click', exportJPG);

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

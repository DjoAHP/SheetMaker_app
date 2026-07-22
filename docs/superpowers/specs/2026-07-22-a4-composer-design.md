# A4 Composer — Design Specification

**Date :** 2026-07-22  
**Projet :** SheetMaker_app / A4 Composer  
**Type :** PWA mobile-first, vanilla HTML/CSS/JS, Canvas 300 DPI

---

## 1. Vision & Objectifs

Application web progressive (PWA) installable sur Android, permettant de composer plusieurs images (captures d'écran de partitions de batterie recadrées) sur une feuille A4 virtuelle, pour impression sans fil depuis un téléphone.

**Principes :**
- 100% client-side, aucune donnée ne sort du navigateur
- Mobile-first, tactile, responsive
- Offline-first (Service Worker + Manifest)
- Code modulaire, maintenable, commenté en français
- Design glassmorphism élégant, icônes Lucide (remplaçables facilement)

---

## 2. Architecture & Stack

| Couche | Technologie |
|--------|-------------|
| Structure | `index.html`, `style.css`, `app.js` |
| Icônes | `icons.js` (mapping nom → SVG Lucide) |
| PWA | `manifest.json`, `sw.js` |
| Assets | `icons/` (PWA icons 192/512), `lucide.min.js` via CDN |
| Canvas | HTML5 Canvas API, 300 DPI (2480×3508 px portrait) |
| Build | Aucun (vanilla, pas de bundler) |

**Arborescence :**
```
SheetMaker_app/
├── index.html
├── style.css
├── app.js
├── icons.js
├── manifest.json
├── sw.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── maskable-512.png
└── docs/superpowers/specs/2026-07-22-a4-composer-design.md
```

---

## 3. Spécifications Fonctionnelles

### 3.1 Plan de travail A4
- **Portrait** : 210×297 mm → 2480×3508 px (300 DPI)
- **Paysage** : 297×210 mm → 3508×2480 px (300 DPI)
- Sélecteur d'orientation (icônes `rectangle-vertical` / `rectangle-horizontal`) toujours visible
- Changement d'orientation → confirmation si calques existants (redimensionnement canvas + réajustement calques)
- Aperçu à l'écran : fit-to-screen avec ombre portée + bordure fine
- Canvas interne : toujours 300 DPI, non redimensionné à l'affichage

### 3.2 Import d'images
- Bouton "Importer" (`image-plus`) → `<input type="file" multiple accept="image/*" capture="environment">`
- Chaque image → nouveau calque centré sur la feuille, z-index incrémental
- Formats supportés : JPEG, PNG, WebP, HEIC (selon navigateur)

### 3.3 Manipulation par calque (tactile + souris)
| Action | Interaction | Détails |
|--------|-------------|---------|
| **Déplacement** | Drag 1 doigt / souris | Déplace le calque entier |
| **Redimensionnement** | Poignée coin (↘) | Ratio verrouillé par défaut ; Shift/btn pour libre |
| **Recadrage** | Double-tap OU bouton `crop` (barre contextuelle) | Mode crop : poignées 4 coins + 4 côtés ; sortie par re-tap ou bouton "Valider" |
| **Suppression** | Bouton `trash-2` (contextuel) | Supprime le calque sélectionné |
| **Ordre (z-index)** | `bring-to-front` / `send-to-back` (contextuel) | Déplace le calque au premier/dernier plan |

**Pas de rotation** (v1).

### 3.4 Barre d'outils (Top Bar — toujours visible)
```
[Groupe 1] [Groupe 2]           [Groupe 3 - Contextuel]           [Groupe 4]
Import     Orientation         Recadrer  Supprimer  ⬆  ⬇        Exporter
(image-plus) (rect-v/rect-h)    (crop)    (trash-2)  (front/back) (download)
```
- Groupes modulaires dans le code (facile d'ajouter outils contextuels)
- Groupe 3 **masqué** si aucun calque sélectionné
- Zones de tap ≥ 44×44 px

### 3.5 Export / Impression
- Bouton "Exporter" (`download`) → rendue hi-res du canvas A4 (fond blanc, sans UI)
- Format : JPEG, qualité 0.92
- Téléchargement : `composition-A4-YYYY-MM-DD-HHmm.jpg`
- **Bonus** : impression sans fil via `window.print()` (optionnel, bouton dédié ou menu)

---

## 4. Design — Glassmorphism

| Élément | Style |
|---------|-------|
| **Fond global** | Dégradé sombre : `linear-gradient(135deg, #0f111a 0%, #1a1d2e 100%)` |
| **Feuille A4** | Fond blanc, `box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)` |
| **Barre d'outils / Modals** | `backdrop-filter: blur(20px)`, `background: rgba(255,255,255,0.12)`, `border: 1px solid rgba(255,255,255,0.18)`, `border-radius: 18px` |
| **Icônes Lucide** | `stroke-width: 1.75`, `width: 22px`, `height: 22px`, `color: rgba(255,255,255,0.9)` |
| **Boutons** | Padding 12px, `transition: transform 0.12s, opacity 0.12s`, `active: scale(0.92)` |
| **Typographie** | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif` |
| **Ombres calque sélectionné** | `box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(59,130,246,0.6), 0 8px 24px rgba(0,0,0,0.3)` |
| **Poignées (resize/crop)** | Cercle 18px, blanc, bordure 2px bleu (#3b82f6), ombre |

---

## 5. Gestion d'État & Rendu

### 5.1 State (app.js)
```javascript
const state = {
  orientation: 'portrait',     // 'portrait' | 'landscape'
  hiRes: { w: 2480, h: 3508 }, // recalculé à chaque changement orientation
  fitRatio: 0.35,              // previewW / hiResW
  canvasOffset: { x: 0, y: 0 },// position preview dans viewport
  layers: [],                  // Layer[]
  selectedLayerId: null,
  cropMode: false,
  cropLayerId: null,
};
```

### 5.2 Layer Object
```javascript
{
  id: 'layer-' + Date.now() + '-' + Math.random().toString(36).slice(2),
  img: HTMLImageElement,       // image chargée
  naturalW: 1200,              // largeur originale (px)
  naturalH: 1600,              // hauteur originale (px)
  x: 400,                      // position X hi-res
  y: 300,                      // position Y hi-res
  w: 1200,                     // largeur affichée hi-res
  h: 1600,                     // hauteur affichée hi-res
  zIndex: 0,                   // ordre empilement
  crop: null,                  // {x,y,w,h} en px naturels OU null
}
```

### 5.3 Boucle de rendu
```javascript
function render() {
  // 1. Canvas hi-res : clear + fond blanc
  hiResCtx.clearRect(0, 0, hiResW, hiResH);
  hiResCtx.fillStyle = '#fff';
  hiResCtx.fillRect(0, 0, hiResW, hiResH);

  // 2. Dessiner calques triés par zIndex
  layers.sort((a,b) => a.zIndex - b.zIndex).forEach(drawLayer);

  // 3. Preview canvas (downscaled)
  previewCtx.drawImage(hiResCanvas, 0, 0, previewW, previewH);

  // 4. UI sélection (poignées, bordure) sur preview uniquement
  if (selectedLayer) drawSelectionUI(previewCtx, selectedLayer);
}
```

### 5.4 drawLayer() avec crop
```javascript
function drawLayer(ctx, layer) {
  const sx = layer.crop?.x ?? 0;
  const sy = layer.crop?.y ?? 0;
  const sw = layer.crop?.w ?? layer.naturalW;
  const sh = layer.crop?.h ?? layer.naturalH;
  ctx.drawImage(layer.img, sx, sy, sw, sh, layer.x, layer.y, layer.w, layer.h);
}
```

### 5.5 Conversion coordonnées Touch ↔ Hi-res
```javascript
function touchToHiRes(clientX, clientY) {
  return {
    x: (clientX - state.canvasOffset.x) / state.fitRatio,
    y: (clientY - state.canvasOffset.y) / state.fitRatio,
  };
}
```

---

## 6. Icônes — Mapping Centralisé (icons.js)

```javascript
// icons.js
export const ICONS = {
  'image-plus': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/><circle cx="12" cy="12" r="10"/></svg>`,
  'rectangle-vertical': `<svg ...>...</svg>`,
  'rectangle-horizontal': `<svg ...>...</svg>`,
  'crop': `<svg ...>...</svg>`,
  'trash-2': `<svg ...>...</svg>`,
  'bring-to-front': `<svg ...>...</svg>`,
  'send-to-back': `<svg ...>...</svg>`,
  'download': `<svg ...>...</svg>`,
  'check': `<svg ...>...</svg>`,      // Valider recadrage
  'x': `<svg ...>...</svg>`,          // Annuler recadrage
  'rotate-ccw': `<svg ...>...</svg>`, // (futur: rotation)
};
```

**Utilisation dans app.js :**
```javascript
import { ICONS } from './icons.js';
btn.innerHTML = ICONS['crop'];
```

**Remplacement futur :** il suffit d'éditer `icons.js` avec tes SVG custom.

---

## 7. PWA — Offline & Installable

### 7.1 manifest.json
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
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 7.2 Service Worker (sw.js)
- **Install** : cache `index.html`, `style.css`, `app.js`, `icons.js`, `manifest.json`, `icons/*`, Lucide CDN (optionnel, ou bundle local)
- **Fetch** : `cache-first` pour assets statiques, `network-first` pour navigation
- **Activate** : nettoyage anciens caches
- **Pas de** : background sync, push, periodic sync (YAGNI)

### 7.3 Installation Prompt
```javascript
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner(); // Toast discret "Installer l'app ?"
});
```

---

## 8. Structure du Code (app.js) — Modulaire

```javascript
// 1. IMPORTS & CONSTANTES
import { ICONS } from './icons.js';
const DPI = 300;
const A4_MM = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } };

// 2. STATE
const state = { ... };

// 3. CANVAS SETUP
const hiResCanvas = document.createElement('canvas');
const hiResCtx = hiResCanvas.getContext('2d');
const previewCanvas = document.getElementById('preview');
const previewCtx = previewCanvas.getContext('2d');

// 4. UTILITAIRES
function mmToPx(mm) { return mm * DPI / 25.4; }
function touchToHiRes(e) { ... }
function generateLayerId() { ... }
function render() { ... }
function drawLayer(ctx, layer) { ... }
function drawSelectionUI(ctx, layer) { ... }
function hitTest(x, y) { ... } // retourne layerId ou null

// 5. GESTION CALQUES
function addLayer(img) { ... }
function removeLayer(id) { ... }
function bringToFront(id) { ... }
function sendToBack(id) { ... }
function updateLayerTransform(id, { x, y, w, h }) { ... }
function setLayerCrop(id, crop) { ... }

// 6. MODE RECADRAGE
function enterCropMode(layerId) { ... }
function exitCropMode(save = true) { ... }
function updateCropHandles() { ... }

// 7. INTERACTIONS TACTILES/SOURIS
function onPointerDown(e) { ... }
function onPointerMove(e) { ... }
function onPointerUp(e) { ... }

// 8. ORIENTATION
function setOrientation(orient) { ... }
function recalculateHiRes() { ... }
function reflowLayers() { ... } // réajuste positions/tailles au changement orientation

// 9. EXPORT
function exportJPG() { ... }
function printA4() { ... } // optionnel

// 10. PWA
function registerSW() { ... }
function handleInstallPrompt() { ... }

// 11. INIT
function init() { ... }
init();
```

---

## 9. Gestion d'Erreurs & Edge Cases

| Cas | Gestion |
|-----|---------|
| Image trop lourde (>50MB) | Alert + refus, suggestion redimensionner |
| Format non supporté | `img.onerror` → toast erreur |
| Canvas 2D context null | Fallback message "Navigateur non supporté" |
| Changement orientation avec calques | Modal confirmation "Réorganiser les calques ?" |
| Crop invalide (w/h ≤ 0) | Ignore, garde crop précédent |
| Touch en dehors canvas | Ignore (hit-test retourne null) |
| PWA non supportée | Dégradé gracieux (fonctionne quand même) |

---

## 10. Tests & Validation (Manuel)

1. **Install PWA** : Chrome Android → "Installer l'application" → icône home screen
2. **Offline** : Mode avion → app fonctionne, import/export OK
3. **Import multiple** : 5+ images → calques créés, z-index OK
4. **Drag/Resize/Crop** : Doigt + souris, fluide 60fps
5. **Orientation switch** : Portrait↔Paysage → canvas recalculé, calques réajustés
6. **Export JPG** : Fichier téléchargé, 300 DPI, 2480×3508, qualité 0.92
7. **Print** : `window.print()` → dialogue impression Android → PDF/imprimante
8. **Icons swap** : Modifier `icons.js` → rebuild pas nécessaire, refresh suffit

---

## 11. Évolutions Futures (Hors v1)

- Rotation calque (90° incréments + libre)
- Duplication calque
- Alignement (grille, snap, distribution)
- Annuler/Refaire (history stack)
- Templates A4 (marges, repères)
- Export PDF multi-pages
- Sync cloud (optionnel, opt-in)

---

## 12. Validation du Design

> **Ce document a été revu et validé.**  
> Prochaine étape : invocation de `writing-plans` pour générer le plan d'implémentation détaillé.
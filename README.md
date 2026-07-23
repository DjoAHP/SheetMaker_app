# 🎵 SheetMaker

**Compose tes partitions sur une feuille A4 — depuis ton téléphone.**

[![Version](https://img.shields.io/badge/version-1.0.1-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## ✨ Fonctionnalités

| Fonction | Description |
|----------|-------------|
| 📷 **Import** | Ajoute tes images (captures d'écran, photos...) |
| 🖼️ **Composition** | Place, déplace, redimensionne sur une feuille A4 virtuelle |
| ✂️ **Recadrage** | Rogne tes images avec un outil intuitif |
| 🔄 **Orientation** | Portrait ou Paysage, un seul tap |
| 🔒 **Verrouillage** | Bloque un calque pour éviter les déplacements accidentels |
| ↩️ **Annuler/Refaire** | Jusqu'à 30 étapes d'historique |
| 📥 **Export JPG** | Résolution 300 DPI, prêt pour l'impression |
| 📱 **PWA** | Installable, fonctionne hors-ligne |

---

## 🚀 Démarrage rapide

```bash
# Lancer le serveur local
bash serve.sh

# Ou manuellement
python3 -m http.server 3000 --bind 0.0.0.0
```

Puis ouvre `http://localhost:3000` dans Chrome.

---

## 📱 Installer sur Android

1. Ouvre l'app dans Chrome
2. Menu → **Ajouter à l'écran d'accueil**
3. L'app est maintenant installée !

---

## 🛠️ Stack technique

```
HTML5 + CSS3 + JavaScript vanilla
Canvas API (300 DPI)
Service Worker (offline-first)
PWA Manifest
```

**Zéro dépendance. Zéro build. 100% client-side.**

---

## 📁 Structure

```
SheetMaker_app/
├── app.js          # Logique principale (~1200 lignes)
├── icons.js        # Mapping icônes SVG
├── index.html      # Structure HTML
├── style.css       # Styles glassmorphism
├── manifest.json   # PWA manifest
├── sw.js           # Service Worker
├── serve.sh        # Serveur de dev
├── assets/         # Logos et icônes sources
│   ├── logo/
│   └── icons/
└── icons/          # Icônes PWA (PNG)
```

---

## 🎨 Design

Interface **glassmorphism** moderne :
- Fond dégradé sombre
- Barres d'outils floues (`backdrop-filter`)
- Icônes Lucide + icônes custom
- Responsive mobile-first

---

## 📝 Licence

MIT — Fais ce que tu veux.

---

*Fait avec ❤️ pour les musiciens.*

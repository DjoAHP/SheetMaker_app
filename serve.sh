#!/bin/bash
# Script pour lancer un serveur local sur le port 3000
# Utilisable depuis ton téléphone (même réseau WiFi)

PORT=${1:-3000}

echo "🚀 Serveur A4 Composer lancé sur :"
echo "   http://localhost:$PORT"
echo ""
echo "📱 Sur ton téléphone (même réseau WiFi) :"
echo "   http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo "   Ou si tu utilises WSL :"
echo "   http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo "   Pour trouver l'IP de ta machine :"
echo "   hostname -I"
echo ""
echo "   Appuie sur Ctrl+C pour arrêter le serveur"
echo ""

python3 -m http.server $PORT --bind 0.0.0.0

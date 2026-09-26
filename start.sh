#!/usr/bin/env bash
# XozHub AI — lance le site + le serveur d'appairage
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est requis : https://nodejs.org"
  exit 1
fi

echo
echo "  XozHub AI — serveur sur http://localhost:8787"
echo "  Ctrl+C pour arrêter."
echo
node server.js

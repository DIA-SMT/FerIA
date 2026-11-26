#!/usr/bin/env bash
# Primera mitad del deploy: clona, instala, construye, migra y PRUEBA la versión
# nueva en el puerto 3013. No toca producción: el symlink `actual` y pm2 quedan
# como estaban. La segunda mitad es deploy-cambiar.sh.
#
# Se copia a la VPS (por ejemplo a /tmp) y corre como el usuario feria,
# desprendido, porque el build tarda y un ssh cortado lo mataba a la mitad:
#   sudo -u feria setsid nohup bash /tmp/deploy-construir.sh <sha> > /tmp/deploy-<sha>.log 2>&1 &
# Se sigue con `tail -f` del log hasta «LISTO PARA CAMBIAR» o «FALLO».
# Sólo la prueba, sobre una versión ya construida:
#   sudo -u feria bash /tmp/deploy-construir.sh --probar /srv/feria/versiones/<carpeta>
#
# La prueba (26/11/2026): antes apagaba el servidor de prueba con
# `pkill -f "next start -p 3013"`, pero Next renombra su proceso a
# «next-server (v…)» y el patrón nunca coincidía. Un servidor del 17/11 quedó
# con el puerto tomado, y desde entonces la prueba le preguntaba a él y no a la
# versión nueva. Ahora: el puerto tiene que estar libre antes de arrancar, el
# que responde tiene que ser un proceso que corre desde la carpeta nueva, y se
# apaga por número de proceso, también si el script se corta a la mitad.
set -euo pipefail

PUERTO_PRUEBA=3013

puerto_ocupado() { ss -ltn | grep -q ":$PUERTO_PRUEBA "; }

# El proceso que escucha en el puerto de prueba, o vacío.
quien_escucha() {
  ss -ltnp 2>/dev/null | grep ":$PUERTO_PRUEBA " | grep -o "pid=[0-9]*" | head -1 | cut -d= -f2
}

PID_PRUEBA=""
apagar_prueba() {
  local escucha
  escucha=$(quien_escucha)
  for pid in $PID_PRUEBA $escucha; do
    # Sólo lo que corre desde la carpeta que se está probando: nunca otra cosa.
    if [ -n "${CARPETA_PRUEBA:-}" ] && [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$CARPETA_PRUEBA" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  for _ in $(seq 1 15); do puerto_ocupado || return 0; sleep 1; done
  echo ">> AVISO: el $PUERTO_PRUEBA sigue ocupado después de apagar la prueba:"
  ss -ltnp | grep ":$PUERTO_PRUEBA " || true
}

probar() {
  CARPETA_PRUEBA=$(readlink -f "$1")
  local registro="/tmp/prueba-$(basename "$CARPETA_PRUEBA").log"

  if puerto_ocupado; then
    echo ">> FALLO: el $PUERTO_PRUEBA ya está ocupado, y así la prueba le preguntaría a otro servidor:"
    ss -ltnp | grep ":$PUERTO_PRUEBA " || true
    echo ">> Producción no se tocó. Hay que liberar el puerto y volver a probar."
    return 1
  fi

  trap apagar_prueba EXIT
  echo ">> Prueba en el $PUERTO_PRUEBA"
  (cd "$CARPETA_PRUEBA" && exec setsid node node_modules/next/dist/bin/next start -p "$PUERTO_PRUEBA" -H 127.0.0.1) \
    > "$registro" 2>&1 < /dev/null &
  PID_PRUEBA=$!

  local ok=0 escucha
  for i in $(seq 1 36); do
    sleep 5
    escucha=$(quien_escucha)
    if [ -n "$escucha" ] && [ "$(readlink -f "/proc/$escucha/cwd" 2>/dev/null)" = "$CARPETA_PRUEBA" ] \
      && [ "$(curl -s -m 20 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PUERTO_PRUEBA/")" = "200" ]; then
      ok=1
      echo ">> $PUERTO_PRUEBA responde 200 a los $((i*5)) s, y es la versión nueva (proceso $escucha, $(basename "$CARPETA_PRUEBA"))"
      break
    fi
  done

  apagar_prueba
  trap - EXIT
  if [ "$ok" != "1" ]; then
    tail -20 "$registro"
    echo ">> FALLO: la versión nueva no respondió en el $PUERTO_PRUEBA. Producción no se tocó."
    return 1
  fi
}

if [ "${1:-}" = "--probar" ]; then
  probar "${2:?falta la carpeta de la versión}"
  exit 0
fi

SHA=${1:?falta el sha}
FECHA=$(date +%Y%m%d-%H%M%S)
DEST=/srv/feria/versiones/$FECHA-$SHA

echo ">> Clonando $DEST"
git clone --quiet --depth 1 --branch main https://github.com/DIA-SMT/FerIA.git "$DEST"
cd "$DEST"
echo ">> $(git log --oneline -1)"
if [ "$(git rev-parse --short HEAD)" != "$SHA" ]; then
  echo ">> FALLO: main está en $(git rev-parse --short HEAD), no en $SHA. Producción no se tocó."
  exit 1
fi
ln -s /srv/feria/compartido/.env .env

echo ">> npm ci"
npm ci --no-audit --no-fund 2>&1 | tail -3

echo ">> build"
if ! npm run build > /tmp/build-$SHA.log 2>&1; then
  echo ">> build fallo; error:"
  grep -iE -m5 "error|failed|fetch" /tmp/build-$SHA.log || tail -20 /tmp/build-$SHA.log
  echo ">> reintento del build"
  npm run build > /tmp/build-$SHA.log 2>&1 || { tail -30 /tmp/build-$SHA.log; echo ">> FALLO"; exit 1; }
fi
tail -3 /tmp/build-$SHA.log

echo ">> Migraciones"
npx prisma migrate deploy 2>&1 | tail -4

probar "$DEST"

echo "$DEST" > /srv/feria/.version-lista
echo ">> LISTO PARA CAMBIAR: $DEST"

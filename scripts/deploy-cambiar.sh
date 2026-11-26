#!/usr/bin/env bash
# Segunda mitad del deploy: pasa producción a la versión que dejó lista
# deploy-construir.sh, espera a que responda y, si en 4 minutos no responde,
# vuelve sola a la anterior.
#
# Se copia a la VPS y corre como el usuario feria (como root dejaba el
# symlink `actual` a nombre de root):
#   sudo -u feria bash /tmp/deploy-cambiar.sh
# Después hay que mirar que el sitio dé 200 desde afuera, no sólo que el
# script termine bien.
set -uo pipefail

export PM2_HOME=/srv/feria/.pm2
NUEVA=$(cat /srv/feria/.version-lista)
ANTERIOR=$(readlink -f /srv/feria/actual)

esperar() {
  for i in $(seq 1 48); do
    sleep 5
    if [ "$(curl -s -m 20 -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/)" = "200" ]; then
      echo ">> responde 200 a los $((i*5)) s"; return 0
    fi
  done
  return 1
}

echo ">> Cambio: $ANTERIOR -> $NUEVA"
ln -sfn "$NUEVA" /srv/feria/actual
pm2 restart feria --update-env > /dev/null
if esperar; then
  echo ">> OK. Para volver atrás: ln -sfn $ANTERIOR /srv/feria/actual && PM2_HOME=/srv/feria/.pm2 pm2 restart feria"
  exit 0
fi

echo ">> NO RESPONDE: vuelvo a $ANTERIOR"
ln -sfn "$ANTERIOR" /srv/feria/actual
pm2 restart feria --update-env > /dev/null
if esperar; then
  echo ">> ROLLBACK OK: producción quedó en $ANTERIOR"
else
  echo ">> ROLLBACK SIN RESPUESTA: revisar a mano"
fi
exit 1

#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: ejecuta este script dentro de un repositorio Git."
  exit 1
}

cd "$PROJECT_ROOT"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

current_branch() {
  git branch --show-current
}

require_feature_branch() {
  local branch
  branch="$(current_branch)"
  [[ -n "$branch" ]] || die "No se pudo determinar la rama actual."
  [[ "$branch" != "main" && "$branch" != "master" ]] ||
    die "Esta operación requiere una rama de trabajo, no '$branch'."
}

require_clean_tree() {
  [[ -z "$(git status --porcelain)" ]] ||
    die "Hay cambios pendientes. Revísalos antes de continuar."
}

require_up_to_date_main() {
  git fetch origin
  git show-ref --verify --quiet refs/remotes/origin/main ||
    die "No existe origin/main."

  local counts
  counts="$(git rev-list --left-right --count main...origin/main)"
  [[ "$counts" == $'0\t0' ]] ||
    die "main no coincide con origin/main. Sincroniza las ramas primero."
}

validate_project() {
  echo
  echo "===== ESLINT ====="
  npm run lint

  echo
  echo "===== TYPESCRIPT ====="
  npx tsc --noEmit

  echo
  echo "Validaciones completadas."
}

case "${1:-help}" in
  start)
    [[ $# -eq 2 ]] || die "Uso: $0 start nombre-de-la-mejora"

    slug="$2"
    [[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] ||
      die "Usa minúsculas, números y guiones; por ejemplo dashboard-metrics."

    [[ "$(current_branch)" == "main" ]] ||
      die "Inicia una mejora desde main."
    require_clean_tree
    require_up_to_date_main

    branch="feature/$slug"
    git show-ref --verify --quiet "refs/heads/$branch" &&
      die "La rama $branch ya existe."

    git switch -c "$branch" origin/main
    echo "Rama creada: $branch"
    ;;

  validate)
    require_feature_branch
    validate_project
    ;;

  build)
    require_feature_branch
    validate_project
    echo
    echo "===== BUILD DE PRODUCCIÓN ====="
    npm run build
    ;;

  review)
    require_feature_branch

    echo "===== ESTADO ====="
    git status --short

    echo
    echo "===== RESUMEN DE CAMBIOS ====="
    git diff --stat
    git diff --cached --stat

    echo
    echo "===== VALIDAR ESPACIOS ====="
    git diff --check
    git diff --cached --check

    echo
    echo "===== DIFERENCIAS SIN PREPARAR ====="
    git diff

    echo
    echo "===== DIFERENCIAS PREPARADAS ====="
    git diff --cached
    ;;

  commit)
    require_feature_branch

    [[ -n "$(git diff --cached --name-only)" ]] ||
      die "No hay cambios preparados. Usa git add con los archivos que revisaste."

    git diff --cached --check

    # Bloquear nombres de archivos que nunca deben versionarse.
    if git diff --cached --name-only |
      grep -Ei '(^|/)\.env($|\.)|(^|/)(id_ed25519|id_rsa|credentials)$|(^|/).*\.(pem|key|p12|pfx|dump|bak)$'
    then
      die "Hay nombres de archivos sensibles en staging."
    fi

    echo
    echo "===== CAMBIOS QUE SE VAN A GUARDAR ====="
    git diff --cached --stat

    echo
    echo "Revisa el contenido con: $0 review"
    read -r -p "¿Confirmas crear el commit con estos cambios? [y/N] " answer
    [[ "$answer" == "y" || "$answer" == "Y" ]] ||
      die "Commit cancelado."

    read -r -p "Mensaje del commit: " message
    [[ -n "${message//[[:space:]]/}" ]] ||
      die "El mensaje no puede estar vacío."

    git commit -m "$message"
    ;;

  publish)
    require_feature_branch
    require_clean_tree

    branch="$(current_branch)"
    echo "Se publicará únicamente la rama: $branch"
    read -r -p "¿Confirmas hacer push a origin/$branch? [y/N] " answer
    [[ "$answer" == "y" || "$answer" == "Y" ]] ||
      die "Publicación cancelada."

    git push -u origin "$branch"
    ;;

  help|--help|-h)
    cat <<'HELP'
Uso:
  scripts/dev-flow.sh start <slug>   Crear una rama desde main actualizada
  scripts/dev-flow.sh validate       Ejecutar ESLint y TypeScript
  scripts/dev-flow.sh build          Validar y construir para producción
  scripts/dev-flow.sh review         Mostrar estado y diferencias
  scripts/dev-flow.sh commit         Guardar cambios preparados con confirmación
  scripts/dev-flow.sh publish        Publicar la rama actual con confirmación

El script no integra ramas automáticamente en main.
HELP
    ;;

  *)
    die "Comando desconocido. Ejecuta: $0 help"
    ;;
esac

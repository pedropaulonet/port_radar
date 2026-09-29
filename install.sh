#!/usr/bin/env bash
set -euo pipefail

case "${LANGUAGE:-${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}}}" in
    pt*) language=pt ;;
    es*) language=es ;;
    *) language=en ;;
esac
say() {
    case "$language" in
        pt) printf '%s\n' "$1" ;;
        es) printf '%s\n' "$2" ;;
        *) printf '%s\n' "$3" ;;
    esac
}

if (( EUID == 0 )); then
    say 'Execute como seu usuário, sem sudo.' 'Ejecuta como tu usuario, sin sudo.' 'Run as your own user, without sudo.' >&2
    exit 1
fi
for dependency in cinnamon ss msgfmt; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        say "Dependência ausente: $dependency. No Mint/Ubuntu: sudo apt install cinnamon iproute2 gettext" \
            "Falta una dependencia: $dependency. En Mint/Ubuntu: sudo apt install cinnamon iproute2 gettext" \
            "Missing dependency: $dependency. On Mint/Ubuntu: sudo apt install cinnamon iproute2 gettext" >&2
        exit 1
    fi
done
version_output=$(cinnamon --version)
if [[ ! "$version_output" =~ ([0-9]+)\.([0-9]+) ]] || (( BASH_REMATCH[1] < 6 )); then
    say 'É necessário Cinnamon 6.0 ou superior.' 'Se requiere Cinnamon 6.0 o posterior.' 'Cinnamon 6.0 or later is required.' >&2
    exit 1
fi

source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
uuid=port-radar@pedropaulo
applet_dir="$HOME/.local/share/cinnamon/applets/$uuid"
locale_dir="$HOME/.local/share/locale"
staging_dir=$(mktemp -d)
trap 'rm -rf -- "$staging_dir"' EXIT

# Compile every catalogue before changing the installed applet.
for catalog in "$source_dir/$uuid/po/"*.po; do
    language_code=$(basename "$catalog" .po)
    mkdir -p "$staging_dir/$language_code/LC_MESSAGES"
    msgfmt --check --check-format "$catalog" -o "$staging_dir/$language_code/LC_MESSAGES/$uuid.mo"
done
mkdir -p "$applet_dir" "$locale_dir"
cp -R -- "$source_dir/$uuid/." "$applet_dir/"
cp -R -- "$staging_dir/." "$locale_dir/"
# A panel refresh can reuse the old module. Reload the xlet itself after an update.
if command -v gdbus >/dev/null 2>&1 && [[ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
    running_applets=$(gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon \
        --method org.Cinnamon.GetRunningXletUUIDs applet 2>/dev/null || true)
    if [[ "$running_applets" == *"$uuid"* ]]; then
        if gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon \
            --method org.Cinnamon.ReloadXlet "$uuid" APPLET >/dev/null 2>&1; then
            say 'Port Radar atualizado. A recarga do applet foi solicitada ao Cinnamon.' \
                'Port Radar actualizado. Se ha solicitado a Cinnamon que recargue el applet.' \
                'Port Radar updated. Cinnamon has been asked to reload the applet.'
            exit 0
        fi
    fi
fi
say 'Port Radar instalado. Adicione-o em Configurações do sistema → Applets. Para atualizar uma instância ativa, encerre a sessão e entre novamente.' \
    'Port Radar instalado. Añádelo en Configuración del sistema → Applets. Para actualizar una instancia activa, cierra la sesión y vuelve a entrar.' \
    'Port Radar installed. Add it in System Settings → Applets. To update an active instance, sign out and back in.'

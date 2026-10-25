#!/bin/sh
set -eu
# Run under dbus-run-session, never against a user's existing keyring service.
mkdir -p dist/password-tests
fixture_root=$(mktemp -d "$PWD/dist/password-tests/keyring-XXXXXX")
export XDG_DATA_HOME="$fixture_root/data"
export XDG_CONFIG_HOME="$fixture_root/config"
export XDG_CACHE_HOME="$fixture_root/cache"
export XDG_RUNTIME_DIR="$fixture_root/runtime"
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
printf 'synthetic-test-keyring' | gnome-keyring-daemon --unlock --components=secrets >/dev/null
node build/testPasswordStorage.js --native

# Source once per shell, or source this file from your own shell profile.
pi() {
  local project="$PWD"
  while [ "$project" != / ]; do
    if [ -f "$project/.pi/bin/pi.sh" ]; then
      bash "$project/.pi/bin/pi.sh" "$@"
      return $?
    fi
    project="$(dirname "$project")"
  done
  command pi "$@"
}

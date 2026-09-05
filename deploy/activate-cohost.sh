#!/usr/bin/env bash
# Run on the target server after staging the release and healthy API service.
# Requires /tmp/cohost-nginx.conf from this repository.
set -euo pipefail

blog_config=/etc/nginx/sites-available/blog
backup_file=/opt/breakout-maker/backups/blog.before-arcade.conf

curl --fail --silent http://127.0.0.1:3107/api/health >/dev/null
if [ ! -f "$backup_file" ]; then
  cp -p "$blog_config" "$backup_file"
fi
install -m 644 /tmp/cohost-nginx.conf /etc/nginx/snippets/breakout-maker.conf
cat > /etc/nginx/conf.d/breakout-rate.conf <<'NGINX'
limit_req_zone $binary_remote_addr zone=breakout_generation:1m rate=6r/m;
NGINX
python3 - <<'PY'
from pathlib import Path
config = Path('/etc/nginx/sites-available/blog')
text = config.read_text()
include = '    include /etc/nginx/snippets/breakout-maker.conf;'
if include not in text:
    marker = '    root /var/www/blog;'
    if text.count(marker) != 1:
        raise SystemExit('Expected exactly one blog root; no config changes made.')
    config.write_text(text.replace(marker, marker + '\n' + include))
PY
if nginx -t && systemctl reload nginx; then
  echo 'Game locations activated; existing blog locations preserved.'
else
  cp -p "$backup_file" "$blog_config"
  nginx -t
  systemctl reload nginx
  echo 'Activation failed; blog configuration restored.' >&2
  exit 1
fi

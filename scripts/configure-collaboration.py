"""Configura el secreto interno local sin mostrarlo ni versionarlo."""
import secrets
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
backend = ROOT / 'backend/.env'
collaboration = ROOT / 'infra/collaboration-server/.env'
if not backend.exists():
    raise SystemExit('Configura primero backend/.env a partir de backend/.env.example.')
for target in (backend, collaboration):
    result = subprocess.run(['git', 'check-ignore', str(target)], cwd=ROOT, capture_output=True)
    if result.returncode:
        raise SystemExit('Los archivos .env deben estar ignorados por Git antes de configurar el secreto.')
lines = backend.read_text().splitlines()
token = next((line.partition('=')[2].strip().strip('"').strip("'") for line in lines
              if line.startswith('COLLAB_SERVICE_TOKEN=')), '') or secrets.token_urlsafe(32)
for target in (backend, collaboration):
    content = target.read_text().splitlines() if target.exists() else []
    content = [line for line in content if not line.startswith('COLLAB_SERVICE_TOKEN=')]
    target.write_text('\n'.join([*content, 'COLLAB_SERVICE_TOKEN=' + token]) + '\n')
    target.chmod(0o600)
print('Secreto interno configurado en los archivos locales ignorados por Git.')

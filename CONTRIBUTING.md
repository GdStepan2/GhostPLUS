"""Deterministic release ZIP containing only extension runtime files."""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
assert manifest['manifest_version'] == 3
assert set(manifest['permissions']) == {'storage','notifications'}
files = {'manifest.json', 'popup/popup.html', 'popup/popup.css', 'popup/popup.js', 'shared/settings.js'}
files.update(manifest['icons'].values())
files.add(manifest['background']['service_worker'])
for entry in manifest['content_scripts']:
    assert all(match.startswith(('https://ghostecos.duckdns.org/v2/social','https://ghostecos.duckdns.org/chat/')) for match in entry['matches'])
    files.update(entry.get('js', []))
    files.update(entry.get('css', []))
for name in files:
    assert (ROOT / name).is_file(), f'Missing file: {name}'
release = ROOT / 'release'
release.mkdir(exist_ok=True)
target = release / f"GhostPLUS-{manifest['version']}.zip"
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(files):
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 19, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (ROOT / name).read_bytes())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == files
print(f'Built {target.name}: {len(files)} files, {target.stat().st_size} bytes')

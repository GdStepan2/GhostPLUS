"""Create a GitHub-ready archive using an explicit public-source allowlist."""
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
version = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
files = {
    '.gitignore', 'README.md', 'PRIVACY.md', 'LICENSE', 'NOTICE.md',
    'CONTRIBUTING.md', 'manifest.json', 'package.json', 'generate_icons.py',
    'tools/build.py', 'tools/source_archive.py', 'tools/render-promo.cjs',
    'tests/browser.cjs', 'tests/package.cjs', 'tests/README.md',
    'store/PUBLISHING.md', 'store/promo.html', 'store/promo-440x280.png',
    'store/promo-1400x560.html', 'store/promo-1400x560.png',
}
for folder, suffixes in {
    'background': {'.js'}, 'content': {'.js', '.css'},
    'shared': {'.js'}, 'popup': {'.html', '.css', '.js'}, 'icons': {'.png'},
}.items():
    files.update(p.relative_to(ROOT).as_posix() for p in (ROOT / folder).iterdir()
                 if p.is_file() and p.suffix in suffixes)
assert all((ROOT / name).is_file() for name in files)
target = ROOT / 'release' / f'GhostPLUS-{version}-source.zip'
target.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(files):
        info = zipfile.ZipInfo('GhostPLUS/' + name, date_time=(2026, 10, 19, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (ROOT / name).read_bytes())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {'GhostPLUS/' + name for name in files}
print(f'Built {target.name}: {len(files)} source files, {target.stat().st_size} bytes')

"""Apply the locally tested entry change exactly, or fail before any write.
Each source and result is checked by SHA256. CI changes are validated here but
written separately through the authorized connector, not the Actions token.
"""
import hashlib
import json
from pathlib import Path

root = Path.cwd().resolve()
parts = sorted((root / '.github/kids-entry-transfer').glob('*.json'))
assert len(parts) == 3, 'Missing transfer part'
prepared = []
seen = set()
for part in parts:
    for change in json.loads(part.read_text()):
        path = change['path']
        assert (path.startswith(('app/', 'docs/')) or path == '.github/workflows/arbor-ci.yml') and path not in seen, 'Invalid target'
        seen.add(path)
        target = root / path
        assert target.resolve().is_relative_to(root), 'Target outside repository'
        old = target.read_text() if target.exists() else ''
        digest = hashlib.sha256(old.encode()).hexdigest() if target.exists() else None
        assert digest == change['before'], 'Base changed: ' + path
        lines = old.splitlines(keepends=True)
        for start, end, value in reversed(change['edits']):
            assert 0 <= start <= end <= len(lines), 'Invalid line range: ' + path
            lines[start:end] = value.splitlines(keepends=True)
        result = ''.join(lines)
        assert hashlib.sha256(result.encode()).hexdigest() == change['after'], 'Patch integrity: ' + path
        prepared.append((target, result))
assert len(prepared) == 14, 'Unexpected file count'
for target, result in prepared:
    if str(target.relative_to(root)).startswith('.github/workflows/'):
        print('Validated for separate authorized connector write:', target.relative_to(root))
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(result)
    print(target.relative_to(root))

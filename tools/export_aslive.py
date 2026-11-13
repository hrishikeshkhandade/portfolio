"""Export the ASLive Random Forest for the browser.

Reads the trained model, scaler and training data (paths given as arguments), and writes:
  public/models/aslive-rf.bin     the whole forest in a compact binary layout
  src/data/aslive-samples.json    a few real samples per letter with the model's real output
  tests/fixtures/aslive-vectors.json   inputs and expected outputs to verify the browser port

Run:  uv run --python 3.13 --with scikit-learn==1.8.0 --with numpy tools/export_aslive.py MODEL SCALER CSV
"""
import csv, json, pickle, struct, sys
from pathlib import Path
import numpy as np

model_path, scaler_path, csv_path = sys.argv[1:4]
root = Path(__file__).resolve().parent.parent
model = pickle.load(open(model_path, 'rb'))
scaler = pickle.load(open(scaler_path, 'rb'))
classes = [str(c) for c in model.classes_]
K = len(classes)

# ---- forest -> flat arrays (left child is always the next node; verified below) ----
thr, link, feat, leaves, starts = [], [], [], [], [0]
for est in model.estimators_:
    t = est.tree_
    base = len(thr)
    for i in range(t.node_count):
        if t.children_left[i] == -1:
            v = t.value[i][0].astype(np.float64)
            v = v / v.sum()
            q = np.round(v * 255).astype(np.uint8)
            feat.append(-1); thr.append(0.0); link.append(len(leaves)); leaves.append(q)
        else:
            assert t.children_left[i] == i + 1, 'tree is not in preorder'
            feat.append(int(t.feature[i])); thr.append(float(t.threshold[i])); link.append(base + int(t.children_right[i]))
    starts.append(len(thr))

header = json.dumps({
    'classes': classes, 'features': int(model.n_features_in_), 'trees': len(model.estimators_),
    'nodes': len(thr), 'leaves': len(leaves), 'starts': starts,
    'mean': [float(x) for x in scaler.mean_], 'scale': [float(x) for x in scaler.scale_],
}).encode()
pad = (-(4 + len(header))) % 4
blob = struct.pack('<I', len(header)) + header + b'\0' * pad
blob += np.asarray(thr, dtype='<f4').tobytes() + np.asarray(link, dtype='<u4').tobytes()
blob += np.asarray(feat, dtype='i1').tobytes() + np.asarray(leaves, dtype='u1').tobytes()
(root / 'public/models').mkdir(parents=True, exist_ok=True)
(root / 'public/models/aslive-rf.bin').write_bytes(blob)

# ---- data ----
labels, rows = [], []
for r in csv.reader(open(csv_path)):
    if len(r) == 64:
        labels.append(r[0]); rows.append([float(x) for x in r[1:]])
X = np.asarray(rows); y = np.asarray(labels)
proba = model.predict_proba(scaler.transform(X))
pred = np.asarray(classes)[proba.argmax(1)]
print(f'model accuracy on its own data: {(pred == y).mean():.4f}  ({len(y)} rows)')

rng = np.random.default_rng(7)
def top4(p):
    order = np.argsort(-p)[:4]
    return [[classes[i], round(float(p[i]), 4)] for i in order]

# a few typical, correctly classified samples per letter (closest to the letter's median shape)
samples = {}
for c in classes:
    idx = np.where((y == c) & (pred == c))[0]
    med = np.median(X[idx], axis=0)
    near = idx[np.argsort(np.linalg.norm(X[idx] - med, axis=1))[:40]]
    pick = rng.choice(near, size=4, replace=False)
    samples[c] = [{'points': [round(float(v), 4) for v in X[i]], 'top': top4(proba[i])} for i in pick]
(root / 'src/data').mkdir(parents=True, exist_ok=True)
(root / 'src/data/aslive-samples.json').write_text(json.dumps(samples, separators=(',', ':')))

# verification vectors: random rows with the original model's full output
pick = rng.choice(len(y), size=150, replace=False)
vectors = [{'x': [round(float(v), 6) for v in X[i]], 'label': str(pred[i]), 'proba': [round(float(v), 4) for v in proba[i]]} for i in pick]
(root / 'tests/fixtures').mkdir(parents=True, exist_ok=True)
(root / 'tests/fixtures/aslive-vectors.json').write_text(json.dumps({'classes': classes, 'vectors': vectors}, separators=(',', ':')))
print(f'wrote forest: {len(blob)/1e6:.2f} MB, {len(thr)} nodes, {len(leaves)} leaves; samples: {K} classes x 4; vectors: {len(vectors)}')

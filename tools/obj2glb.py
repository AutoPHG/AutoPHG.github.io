"""Convert the Roblox Studio OBJ export of the AutoPHG avatar into a rigged-by-hierarchy GLB.

The OBJ has one group per body part (R15, 15 parts) plus 5 accessory handles.
We rebuild a node hierarchy with joint pivots so the site can pose/animate it.
Usage: python obj2glb.py <model.obj> <texture_dir> <extra_texture_dir> <out.glb>
"""
import io, json, struct, sys, os
import numpy as np
from PIL import Image

obj_path, tex_dir, tex_dir2, out_path = sys.argv[1:5]

CX, CZ = -24.54, -4.99          # avatar centre in the Studio scene

# ---------- parse ----------
V, VT, VN, groups, cur = [], [], [], {}, None
with open(obj_path, encoding="utf-8", errors="ignore") as f:
    for line in f:
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("vn "):
            VN.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("g "):
            cur = {"faces": [], "mtl": None}
            groups[line[2:].strip()] = cur
        elif line.startswith("usemtl "):
            cur["mtl"] = line.split()[1]
        elif line.startswith("f "):
            cur["faces"].append([tuple(int(i) - 1 for i in p.split("/")) for p in line.split()[1:]])
V, VT, VN = np.array(V, np.float64), np.array(VT, np.float64), np.array(VN, np.float64)

# recentre + turn to face +Z (Roblox characters face -Z)
V[:, 0] = -(V[:, 0] - CX)
V[:, 2] = -(V[:, 2] - CZ)
VN[:, 0] *= -1
VN[:, 2] *= -1


def build(name):
    g = groups[name]
    remap, pos, nor, uv, idx = {}, [], [], [], []
    for face in g["faces"]:
        ids = []
        for key in face:
            if key not in remap:
                remap[key] = len(pos)
                pos.append(V[key[0]]); uv.append(VT[key[1]]); nor.append(VN[key[2]])
            ids.append(remap[key])
        for i in range(1, len(ids) - 1):          # fan-triangulate
            idx += [ids[0], ids[i], ids[i + 1]]
    uv = np.array(uv)
    uv[:, 1] = 1.0 - uv[:, 1]
    return np.array(pos), np.array(nor), uv, np.array(idx, np.uint32), g["mtl"]


# name, obj group, parent, pivot (world, after recentre)
R, L = -1.0, 1.0   # character's right is -X once it faces +Z
NODES = [
    ("Hips",      "Autophg3",  None,       (0, 2.22, 0)),
    ("Coat",      "Handle2",   "Hips",     (0, 2.30, 0)),
    ("Torso",     "Autophg7",  "Hips",     (0, 2.42, 0)),
    ("Sword",     "Handle4",   "Torso",    None),          # pivot = own centre
    ("Head",      "Autophg1",  "Torso",    (0, 4.02, 0)),
    ("Hair",      "Handle1",   "Head",     (0, 4.02, 0)),
    ("HairB",     "Handle3",   "Head",     (0, 4.02, 0)),
    ("Mask",      "Handle5",   "Head",     (0, 4.02, 0)),
    ("ArmR",      "Autophg10", "Torso",    (R * 1.5, 3.72, 0)),
    ("ForearmR",  "Autophg12", "ArmR",     (R * 1.5, 3.06, 0)),
    ("HandR",     "Autophg14", "ForearmR", (R * 1.5, 2.30, 0)),
    ("ArmL",      "Autophg11", "Torso",    (L * 1.5, 3.72, 0)),
    ("ForearmL",  "Autophg13", "ArmL",     (L * 1.5, 3.06, 0)),
    ("HandL",     "Autophg15", "ForearmL", (L * 1.5, 2.30, 0)),
    ("LegR",      "Autophg2",  "Hips",     (R * 0.5, 2.05, 0)),
    ("ShinR",     "Autophg4",  "LegR",     (R * 0.5, 1.20, 0)),
    ("FootR",     "Autophg5",  "ShinR",    (R * 0.5, 0.27, 0)),
    ("LegL",      "Autophg6",  "Hips",     (L * 0.5, 2.05, 0)),
    ("ShinL",     "Autophg8",  "LegL",     (L * 0.5, 1.20, 0)),
    ("FootL",     "Autophg9",  "ShinL",    (L * 0.5, 0.27, 0)),
]

MATS = {  # mtl -> (file, roughness, metallic)
    "Autophg1Mtl": ("Autophg1_diff.png", 0.62, 0.0),
    "Handle1Mtl":  ("Handle1_diff.png", 0.55, 0.0),
    "Handle2Mtl":  ("Handle2_diff.png", 0.70, 0.0),
    "Handle3Mtl":  ("Handle3_diff.png", 0.55, 0.0),
    "Handle4Mtl":  ("Handle4_diff.png", 0.32, 0.55),
    "Handle5Mtl":  ("Handle5_diff.png", 0.60, 0.0),
}

# ---------- assemble glTF ----------
bin_chunks, views, accessors = [], [], []
offset = 0


def add_view(data: bytes, target=None):
    global offset
    pad = (-len(data)) % 4
    views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), **({"target": target} if target else {})})
    bin_chunks.append(data + b"\x00" * pad)
    offset += len(data) + pad
    return len(views) - 1


def add_acc(arr, ctype, atype, target, minmax=False):
    v = add_view(arr.tobytes(), target)
    a = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]) if arr.ndim > 1 else int(arr.size), "type": atype}
    if minmax:
        a["min"] = [float(x) for x in arr.min(0)]
        a["max"] = [float(x) for x in arr.max(0)]
    accessors.append(a)
    return len(accessors) - 1


images, textures, materials, mat_index = [], [], [], {}
for mtl, (fn, rough, metal) in MATS.items():
    p = os.path.join(tex_dir, fn)
    if not os.path.exists(p):
        p = os.path.join(tex_dir2, fn)
    im = Image.open(p).convert("RGB")           # every texture is effectively opaque
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    images.append({"bufferView": add_view(buf.getvalue()), "mimeType": "image/png", "name": fn})
    textures.append({"source": len(images) - 1, "sampler": 0})
    materials.append({"name": mtl.replace("Mtl", ""), "pbrMetallicRoughness": {
        "baseColorTexture": {"index": len(textures) - 1}, "metallicFactor": metal, "roughnessFactor": rough}})
    mat_index[mtl] = len(materials) - 1

meshes, nodes, name2idx, pivots = [], [], {}, {}
for name, grp, parent, pivot in NODES:
    pos, nor, uv, idx, mtl = build(grp)
    if pivot is None:
        pivot = tuple(((pos.max(0) + pos.min(0)) / 2).tolist())
    pivots[name] = np.array(pivot, np.float64)
    local = (pos - pivots[name]).astype(np.float32)
    n = nor / np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9)
    prim = {"attributes": {
        "POSITION": add_acc(local, 5126, "VEC3", 34962, True),
        "NORMAL": add_acc(n.astype(np.float32), 5126, "VEC3", 34962),
        "TEXCOORD_0": add_acc(uv.astype(np.float32), 5126, "VEC2", 34962)},
        "indices": add_acc(idx.astype(np.uint16 if len(pos) < 65536 else np.uint32), 5123 if len(pos) < 65536 else 5125, "SCALAR", 34963),
        "material": mat_index[mtl]}
    meshes.append({"name": name, "primitives": [prim]})
    base = pivots[parent] if parent else np.zeros(3)
    nodes.append({"name": name, "mesh": len(meshes) - 1, "translation": [float(x) for x in (pivots[name] - base)]})
    name2idx[name] = len(nodes) - 1
    if parent:
        nodes[name2idx[parent]].setdefault("children", []).append(name2idx[name])
    print(f"{name:9s} <- {grp:10s} verts={len(pos):5d} tris={len(idx)//3:5d} pivot={np.round(pivots[name],2)}")

nodes.append({"name": "AutoPHG", "children": [name2idx["Hips"]]})
gltf = {
    "asset": {"version": "2.0", "generator": "autophg obj2glb"},
    "scene": 0, "scenes": [{"nodes": [len(nodes) - 1]}],
    "nodes": nodes, "meshes": meshes, "materials": materials, "textures": textures, "images": images,
    "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
    "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": offset}],
}
js = json.dumps(gltf, separators=(",", ":")).encode()
js += b" " * ((-len(js)) % 4)
blob = b"".join(bin_chunks)
with open(out_path, "wb") as f:
    f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(blob)))
    f.write(struct.pack("<I4s", len(js), b"JSON")); f.write(js)
    f.write(struct.pack("<I4s", len(blob), b"BIN\x00")); f.write(blob)
print("wrote", out_path, os.path.getsize(out_path), "bytes")

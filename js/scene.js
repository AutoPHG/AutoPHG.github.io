/* AutoPHG — WebGL stage
   One fixed, transparent canvas. The avatar (exported from Roblox Studio and rebuilt as a
   jointed GLB) is posed procedurally. main.js feeds a "shot" every frame (where the avatar
   sits on screen, which pose weights are on); timed "acts" (the super-hero entrance, the
   leaping slash) take over the pose while they play. */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const FOV = 28, MODEL_H = 6, TARGET_Y = 3, TAU = Math.PI * 2;
const RED = new THREE.Color('#ee1026'), BONE = new THREE.Color('#fff4e2');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

/* ---------- poses: joint -> [rx, ry, rz]; `_y` lowers / raises the hips ---------- */
const JOINTS = ['Hips', 'Torso', 'Head', 'ArmR', 'ForearmR', 'HandR', 'ArmL', 'ForearmL', 'HandL',
  'LegR', 'ShinR', 'FootR', 'LegL', 'ShinL', 'FootL', 'Coat'];
const SHOULDER = { ArmR: [-0.5, -0.98, 0], ForearmR: [-2.17, 0, 0] };            // blade resting across the shoulders, behind the head
const P = {
  rest: { ...SHOULDER, Hips: [0, -0.1, 0], Head: [0.1, 0.1, 0], Torso: [-0.05, 0.08, 0],
    ArmL: [0.1, 0, 0.3], ForearmL: [-0.55, 0, 0], LegR: [0, 0, -0.08], LegL: [0, 0, 0.1] },
  present: { ...SHOULDER, Head: [0.02, 0.2, 0], Torso: [-0.06, 0.12, 0],
    ArmL: [-0.25, 0, 1.25], ForearmL: [-0.35, 0, 0], HandL: [0, 0, 0.2], LegR: [0, 0, -0.1], LegL: [0, 0, 0.1] },
  wave: { ...SHOULDER, Head: [0.02, -0.12, 0.08], Torso: [0, -0.06, 0.03],
    ArmL: [0, 0, 2.55], ForearmL: [0, 0, 0.5], LegR: [0, 0, -0.05], LegL: [0, 0, 0.05] },
  point: { ...SHOULDER, Hips: [0, 0.18, 0], Head: [0.12, -0.16, 0.05], Torso: [0.06, 0.1, 0],
    ArmL: [-1.5, 0, 0.12], ForearmL: [-0.08, 0, 0], LegR: [0, 0, -0.1], LegL: [-0.12, 0, 0.1] },
  // --- entrance ---
  fall: { Head: [0.3, 0, 0], Torso: [0.15, 0, 0], ArmR: [0, 0, -2.3], ArmL: [0, 0, 2.3],
    LegR: [-0.6, 0, -0.2], ShinR: [1.0, 0, 0], LegL: [-0.15, 0, 0.2], ShinL: [1.2, 0, 0], Coat: [-0.5, 0, 0] },
  land: { _y: -1.25, Hips: [0.25, 0.2, 0], Torso: [0.7, -0.12, 0], Head: [0.35, 0, 0],
    LegR: [-2.25, 0, -0.22], ShinR: [2.0, 0, 0], LegL: [0.1, 0, 0.28], ShinL: [1.25, 0, 0], FootL: [0.5, 0, 0],
    ArmR: [-0.95, 0, 0.32], ForearmR: [-0.1, 0, 0], ArmL: [1.05, 0, 1.0], ForearmL: [-0.25, 0, 0], Coat: [0.95, 0, 0] },
  land2: { _y: -1.2, Hips: [0.22, 0.2, 0], Torso: [0.62, -0.12, 0], Head: [-0.8, -0.1, 0],
    LegR: [-2.25, 0, -0.22], ShinR: [2.0, 0, 0], LegL: [0.1, 0, 0.28], ShinL: [1.25, 0, 0], FootL: [0.5, 0, 0],
    ArmR: [-0.9, 0, 0.32], ForearmR: [-0.1, 0, 0], ArmL: [1.15, 0, 1.05], ForearmL: [-0.25, 0, 0], Coat: [0.95, 0, 0] },
  draw: { Head: [0.1, -0.15, 0], Torso: [-0.06, -0.2, 0], ArmR: [-2.75, 0, 0.18], ForearmR: [-0.55, 0, 0],
    ArmL: [0.2, 0, 0.3], ForearmL: [-0.4, 0, 0], LegR: [0.12, 0, -0.08], LegL: [-0.12, 0, 0.08] },
  windup: { _y: -0.12, Hips: [0, -0.3, 0], Head: [0.05, 0.42, 0], Torso: [-0.18, -0.55, 0],
    ArmR: [-2.95, 0, -0.35], ForearmR: [-0.75, 0, 0], ArmL: [-0.9, 0, 0.5], ForearmL: [-0.6, 0, 0],
    LegR: [0.4, 0, -0.1], ShinR: [0.25, 0, 0], LegL: [-0.5, 0, 0.1], ShinL: [0.45, 0, 0] },
  strike: { _y: -0.52, Hips: [0.12, 0.45, 0], Head: [-0.12, -0.5, 0], Torso: [0.4, 0.6, 0],
    ArmR: [-0.75, 0, 0.75], ForearmR: [-0.2, 0, 0], HandR: [0.5, 0, 0], ArmL: [0.9, 0, 0.6], ForearmL: [-0.3, 0, 0],
    LegR: [0.75, 0, -0.1], ShinR: [0.35, 0, 0], LegL: [-1.05, 0, 0.1], ShinL: [1.15, 0, 0], Coat: [0.3, 0, 0] },
  strike2: { _y: -0.44, Hips: [0.1, 0.4, 0], Head: [-0.06, -0.45, 0], Torso: [0.34, 0.52, 0],
    ArmR: [-0.6, 0, 0.7], ForearmR: [-0.25, 0, 0], HandR: [0.5, 0, 0], ArmL: [0.8, 0, 0.55], ForearmL: [-0.35, 0, 0],
    LegR: [0.7, 0, -0.1], ShinR: [0.35, 0, 0], LegL: [-0.95, 0, 0.1], ShinL: [1.05, 0, 0], Coat: [0.25, 0, 0] },
  // --- leaping slash ---
  crouch: { ...SHOULDER, _y: -0.75, Torso: [0.45, 0, 0], Head: [-0.2, 0, 0], ArmL: [0.7, 0, 0.3],
    LegR: [-1.0, 0, -0.1], ShinR: [1.7, 0, 0], LegL: [-1.0, 0, 0.1], ShinL: [1.7, 0, 0] },
  air: { Torso: [-0.3, -0.2, 0], Head: [0.25, 0.1, 0], ArmR: [-3.0, 0, -0.3], ForearmR: [-0.65, 0, 0],
    ArmL: [-2.6, 0, 0.35], ForearmL: [-0.5, 0, 0], LegR: [0.55, 0, -0.1], ShinR: [1.25, 0, 0], LegL: [-0.7, 0, 0.1], ShinL: [1.4, 0, 0], Coat: [-0.45, 0, 0] },
};
/* acts: timed key poses. e = easing into this key ('in' accelerate, 'out' settle, 'snap' whip). arm = sword in hand from here. */
const ACTS = {
  entrance: [
    { t: 0.00, p: 'fall', y: 17 },
    { t: 0.46, p: 'land', y: 0, e: 'in', ev: 'land' },
    { t: 1.05, p: 'land' },
    { t: 1.35, p: 'land2', e: 'out' },
    { t: 1.85, p: 'draw', e: 'out', arm: true },
    { t: 2.12, p: 'windup', e: 'out' },
    { t: 2.24, p: 'strike', e: 'snap', ev: 'slash' },
    { t: 2.85, p: 'strike2', e: 'out' },
    { t: 3.45, p: 'rest', e: 'out' },
  ],
  leap: [
    { t: 0.00, p: 'rest', arm: true },
    { t: 0.20, p: 'crouch', e: 'out' },
    { t: 0.50, p: 'air', y: 3.3, e: 'out' },
    { t: 0.68, p: 'air', y: 3.1 },
    { t: 0.84, p: 'strike', y: 0, e: 'in', ev: 'slashLand' },
    { t: 1.50, p: 'strike2', e: 'out' },
    { t: 2.15, p: 'rest', e: 'out' },
  ],
};
const EASE = { in: (k) => k * k, out: (k) => 1 - (1 - k) * (1 - k), snap: (k) => Math.pow(k, 0.45), lin: (k) => k };

function rimPatch(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = uniforms.uRimColor; sh.uniforms.uRimPower = uniforms.uRimPower;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimPower;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.4);
        totalEmissiveRadiance += uRimColor * rimF * uRimPower;`);
  };
  mat.customProgramCacheKey = () => 'rim';
}
function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.translate(64, 64); g.fillStyle = '#fff'; g.beginPath();
  [[0, -62], [5, -5], [62, 0], [5, 5], [0, 62], [-5, 5], [-62, 0], [-5, -5]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function createScene(canvas, hooks = {}) {
  const mobile = matchMedia('(max-width: 860px)').matches || matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
  let W = 1, H = 1;
  // soft studio reflections so the blacks have shape and the sword reads as metal
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.42;

  /* ---------- lights: warm key + shadow, red rim, teal fill, white kicker ---------- */
  const hemi = new THREE.HemisphereLight(0xfff1e0, 0x16060a, 0.3);
  const key = new THREE.DirectionalLight(0xfff0dc, 3.1); key.position.set(5, 9, 7.5);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 10, bottom: -3, near: 1, far: 40 });
  const rim = new THREE.DirectionalLight(RED, 8.5); rim.position.set(-6.5, 5, -7);
  const kick = new THREE.DirectionalLight(0xffffff, 2.4); kick.position.set(6.5, 6, -6);
  const fill = new THREE.DirectionalLight(0x22d2c4, 1.5); fill.position.set(-7, 1.5, 5);
  const under = new THREE.PointLight(RED, 7, 8, 2); under.position.set(0, 0.5, 1.8);
  scene.add(hemi, key, rim, kick, fill, under);
  const rimU = { uRimColor: { value: RED.clone() }, uRimPower: { value: 0.3 } };

  /* ---------- avatar ---------- */
  const world = new THREE.Group(); scene.add(world);
  const root = new THREE.Group(); world.add(root); root.visible = false;
  const J = {}, rest = {};
  const gltf = await new GLTFLoader().loadAsync('media/model/autophg.glb', (e) => { if (hooks.onProgress && e.total) hooks.onProgress(e.loaded / e.total); });
  gltf.scene.traverse((o) => {
    if (o.name) J[o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    const m = o.material; if (m.userData.patched) return; m.userData.patched = true;
    const n = m.name; m.map.anisotropy = 8; m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffffff);
    m.emissiveIntensity = n === 'Handle5' ? 0.7 : n === 'Autophg1' ? 0.45 : n === 'Handle4' ? 0.22 : 0.26;
    if (n === 'Handle4') { m.metalness = 0.85; m.roughness = 0.26; } else { m.roughness = n === 'Handle2' ? 0.7 : 0.52; }
    rimPatch(m, rimU);
  });
  root.add(gltf.scene);
  JOINTS.concat('Sword', 'Hair').forEach((n) => { rest[n] = { p: J[n].position.clone(), q: J[n].quaternion.clone() }; });

  // sword-in-hand transform: the blade (handle -> tip) runs along (1,-1,0)/√2 in sword space
  const grip = (() => {
    const s = Math.SQRT1_2;
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(0, 0, 1, 0, -s, -s, 0, 0, s, -s, 0, 0, 0, 0, 0, 1));
    return { q, p: new THREE.Vector3(0, -0.14, 0.02).sub(new THREE.Vector3(-1.84, 1.84, 0).applyQuaternion(q)) };
  })();
  let armed = false;
  function setArmed(v) {
    if (v === armed) return; armed = v; const sw = J.Sword;
    if (v) { J.HandR.add(sw); sw.position.copy(grip.p); sw.quaternion.copy(grip.q); }
    else { J.Torso.add(sw); sw.position.copy(rest.Sword.p); sw.quaternion.copy(rest.Sword.q); }
  }

  /* ---------- stage pad + shadow catcher ---------- */
  const padU = { uOpacity: { value: 1 }, uColor: { value: RED.clone() }, uTime: { value: 0 } };
  const pad = new THREE.Mesh(new THREE.CircleGeometry(3.6, 72), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: padU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uOpacity, uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - .5) * 2.; float r = length(p);
        vec2 g = floor(p * 5.); float chk = mod(g.x + g.y, 2.);
        vec3 base = mix(vec3(.012), vec3(.05), chk);
        float ring = smoothstep(.022, .0, abs(r - .93));
        float ring2 = smoothstep(.008, .0, abs(r - .7)) * .35;
        vec3 col = base + uColor * (ring * 2.4 + ring2 + smoothstep(.6, .0, r) * .12);
        gl_FragColor = vec4(col, smoothstep(1., .95, r) * .93 * uOpacity);
        #include <colorspace_fragment>
      }` }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.01; pad.renderOrder = -3; world.add(pad);
  const catcher = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.ShadowMaterial({ opacity: 0.55, transparent: true, depthWrite: false }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.02; catcher.receiveShadow = true; catcher.renderOrder = -2; world.add(catcher);
  const shocks = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.renderOrder = -1; world.add(m); return m;
  });

  /* ---------- sparse ambient: a few stars, embers, one lightning flash on impacts ---------- */
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const starTex = starTexture(); const stars = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: i % 2 ? 0xffffff : 0xee1026, transparent: true, depthWrite: false }));
    const a = rnd() * TAU, r = 3.4 + rnd() * 3.2;
    sp.userData = { base: new THREE.Vector3(Math.cos(a) * r, 1.4 + rnd() * 5.4, Math.sin(a) * r * 0.5 - 1.5), s: 0.22 + rnd() * 0.4, ph: rnd() * TAU };
    world.add(sp); stars.push(sp);
  }
  const EMB = mobile ? 34 : 60;
  const embGeo = new THREE.BufferGeometry(); const ep = new Float32Array(EMB * 3), es = new Float32Array(EMB);
  for (let i = 0; i < EMB; i++) { const a = rnd() * TAU, r = 0.8 + rnd() * 4.6; ep[i * 3] = Math.cos(a) * r; ep[i * 3 + 2] = Math.sin(a) * r; es[i] = rnd(); }
  embGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3)); embGeo.setAttribute('aSeed', new THREE.BufferAttribute(es, 1));
  const embU = { uTime: { value: 0 }, uScale: { value: 1 }, uOpacity: { value: 1 }, uBurst: { value: 0 }, uColor: { value: new THREE.Color('#ff3b2a') } };
  const embers = new THREE.Points(embGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: embU,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uBurst; varying float vA;
      void main(){ float t = fract(aSeed + uTime * (.03 + aSeed * .05)); vec3 p = position * (1. + uBurst * .6);
        p.y = t * 8.; p.x += sin(uTime * .7 + aSeed * 40.) * .4; p.z += cos(uTime * .5 + aSeed * 23.) * .4;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (3. + aSeed * 8.) * (1. - t * .7) * (22. / -mv.z) * (1. + uBurst); vA = sin(t * 3.14159); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .05, d) * vA * uOpacity;
        gl_FragColor = vec4(uColor * 1.6, a);
        #include <colorspace_fragment>
      }` }));
  embers.frustumCulled = false; world.add(embers);
  const boltTex = new THREE.TextureLoader().load('media/img/bolt-red.webp'); boltTex.colorSpace = THREE.SRGBColorSpace;
  const bolts = [[-3.9, 4.4, -2.6, 0.5, 5], [4.1, 3.2, -3, -2.2, 4]].map(([x, y, z, rot, s]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: boltTex, transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z); m.rotation.z = rot; m.scale.setScalar(s); m.userData = { t: -1 }; world.add(m); return m;
  });

  /* ---------- speed lines (I PLAY) ---------- */
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xfff4e2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const lineMatR = lineMat.clone(); lineMatR.color = RED.clone();
  const lines = [];
  for (let i = 0; i < (mobile ? 14 : 22); i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.03 + rnd() * 0.04, 0.03 + rnd() * 0.04, 2.5 + rnd() * 6), i % 3 ? lineMat : lineMatR);
    const a = rnd() * TAU, r = 2.4 + rnd() * 4.2;
    m.userData = { x: Math.cos(a) * r, y: 3 + Math.sin(a) * r * 0.8, z: rnd() * 40 - 20, v: 26 + rnd() * 30 }; world.add(m); lines.push(m);
  }

  /* ---------- slash arc ---------- */
  const ARC = { R: 7, start: THREE.MathUtils.degToRad(14), len: THREE.MathUtils.degToRad(78) };
  const arcU = { uProg: { value: 0 }, uFade: { value: 0 }, uStart: { value: ARC.start }, uLen: { value: ARC.len }, uIn: { value: ARC.R - 1.2 }, uOut: { value: ARC.R + 0.12 } };
  const arc = new THREE.Mesh(new THREE.RingGeometry(ARC.R - 1.2, ARC.R + 0.12, 72, 1, ARC.start, ARC.len), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: arcU,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uProg, uFade, uStart, uLen, uIn, uOut; varying vec2 vP;
      void main(){
        float a = 1. - (atan(vP.y, vP.x) - uStart) / uLen;
        float rr = (length(vP) - uIn) / (uOut - uIn);
        float taper = sin(clamp(a, 0., 1.) * 3.14159);
        float body = smoothstep(1. - taper * .95, 1. - taper * .2, rr) * smoothstep(1., .93, rr);
        float swept = step(a, uProg) * smoothstep(uProg - .9, uProg, a);
        vec3 col = mix(vec3(1., .05, .12), vec3(1.), smoothstep(.5, .98, rr));
        gl_FragColor = vec4(col * 1.5, body * swept * uFade);
        #include <colorspace_fragment>
      }` }));
  arc.position.set(-3.3, -1.5, 1.9); arc.renderOrder = 5; arc.visible = false; world.add(arc);

  /* ---------- clip storm (I POST) ---------- */
  const storm = new THREE.Group(); world.add(storm); const cards = [];
  const cardBack = new THREE.MeshBasicMaterial({ color: 0xee1026, side: THREE.DoubleSide });
  function loadClips(urls) {
    if (cards.length) return;
    const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
    urls.slice(0, mobile ? 8 : 12).forEach((url, i, arr) => {
      const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0x151515 });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); face.position.z = 0.012;
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.06), cardBack), face);
      const hi = i % 2;
      g.userData = { a: (i / arr.length) * TAU, r: hi ? 5.7 : 4.5, y: hi ? 5.3 + (i % 3) * 0.55 : 0.75 + (i % 4) * 0.42, h: hi ? 1.5 : 1.75, w: 1, k: i / arr.length, tilt: (rnd() - 0.5) * 0.3 };
      g.scale.setScalar(0.0001); storm.add(g); cards.push(g);
      loader.load(url, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; g.userData.w = tex.image.width / tex.image.height; }, undefined, () => {});
    });
  }

  /* ---------- state ---------- */
  const cur = { fx: 0.5, fy: 0.52, fh: 0.62, yaw: 0, pitch: 0, turn: 0, vis: 1, run: 0, storm: 0, look: 1, pad: 1, fx3d: 1, light: 0, rest: 1, present: 0, wave: 0, point: 0 };
  let first = true, time = 0, landed = false;
  const pose = {}, poseB = {}; JOINTS.forEach((n) => { pose[n] = [0, 0, 0]; poseB[n] = [0, 0, 0]; });
  const e = new THREE.Euler();
  const fxs = { shockT: -1, slashT: -1, shake: 0, squash: 0, squashV: 0, burst: 0, burstV: 0, hair: 0, hairV: 0 };
  const act = { name: null, t: 0, blend: 0, fired: new Set() };

  const zero = (dst) => JOINTS.forEach((n) => { const a = dst[n]; a[0] = a[1] = a[2] = 0; });
  function add(dst, p, w) {
    if (w <= 0.0005 || !p) return 0;
    for (const n in p) { if (n === '_y') continue; const a = dst[n], b = p[n]; a[0] += b[0] * w; a[1] += b[1] * w; a[2] += b[2] * w; }
    return (p._y || 0) * w;
  }
  function play(name) { act.name = name; act.t = 0; act.blend = 1; act.fired.clear(); root.visible = true; if (name === 'entrance') { landed = false; setArmed(false); } }
  function skipIntro() { root.visible = true; landed = true; setArmed(true); act.name = null; act.blend = 0; }
  function impact(kind) {
    fxs.shockT = 0; fxs.shake = kind === 'land' ? 1 : 1.25; fxs.squashV = kind === 'slash' ? 0 : -6.5; fxs.burstV = 7; fxs.hairV = -6;
    bolts.forEach((b, i) => { b.userData.t = -i * 0.06; });
    if (kind !== 'land') fxs.slashT = 0;
    if (kind === 'land') { landed = true; hooks.onLand && hooks.onLand(); } else hooks.onSlash && hooks.onSlash(kind);
  }

  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  function frame(shot, env) {
    const dt = Math.min(env.dt, 0.05); time += dt;
    for (const k in cur) { const target = shot[k] ?? 0; cur[k] = first ? target : damp(cur[k], target, k === 'vis' ? 9 : (k === 'point' || k === 'wave' || k === 'present' || k === 'rest') ? 8 : 5.5, dt); }
    first = false;
    canvas.style.opacity = cur.vis < 0.995 ? cur.vis.toFixed(3) : '';
    if (cur.vis < 0.01) return;

    // ---- scroll-driven pose ----
    zero(pose);
    const still = 1 - cur.run;
    const others = clamp(cur.present + cur.wave + cur.point);
    let hipY = add(pose, P.rest, clamp(cur.rest - others) * still) + add(pose, P.present, cur.present * still) + add(pose, P.wave, cur.wave * still) + add(pose, P.point, cur.point * still);
    if (cur.run > 0.002) {                                   // sprint with the blade trailing behind
      const w = cur.run, ph = time * 11.5, s = Math.sin(ph), c = Math.cos(ph);
      pose.LegR[0] += -s * 0.95 * w; pose.LegL[0] += s * 0.95 * w;
      pose.ShinR[0] += (0.35 + Math.max(0, c) * 1.15) * w; pose.ShinL[0] += (0.35 + Math.max(0, -c) * 1.15) * w;
      pose.ArmR[0] += (0.8 + s * 0.12) * w; pose.ArmR[2] += -0.28 * w; pose.ForearmR[0] += -0.15 * w; pose.HandR[0] += 2.25 * w;
      pose.ArmL[0] += -s * 1.05 * w; pose.ArmL[2] += 0.12 * w; pose.ForearmL[0] += -1.15 * w;
      pose.Torso[0] += 0.3 * w; pose.Torso[1] += s * 0.12 * w; pose.Head[0] += -0.18 * w; pose.Coat[0] += (0.3 + c * 0.08) * w;
      hipY += (Math.abs(c) * 0.22 - 0.1) * w;
    }
    if (cur.wave > 0.01) { const wv = Math.sin(time * 7.5); pose.ForearmL[2] += wv * 0.42 * cur.wave; pose.ArmL[2] += wv * 0.06 * cur.wave; }

    // ---- timed act (overrides) ----
    let rootY = 0;
    if (act.name) {
      const K = ACTS[act.name]; act.t += dt;
      let i = 0; while (i < K.length - 2 && act.t > K[i + 1].t) i++;
      const A = K[i], B = K[i + 1];
      const k = (EASE[B.e] || EASE.lin)(clamp((act.t - A.t) / (B.t - A.t)));
      zero(poseB);
      let y = add(poseB, P[A.p], 1 - k) + add(poseB, P[B.p], k);
      rootY = lerp(A.y || 0, B.y || 0, k);
      K.forEach((key, j) => {
        if (act.t >= key.t && !act.fired.has(j)) { act.fired.add(j); if (key.arm) setArmed(true); if (key.ev) impact(key.ev === 'land' ? 'land' : key.ev); }
      });
      const end = K[K.length - 1].t;
      if (act.t > end) { act.blend = Math.max(0, 1 - (act.t - end) / 0.3); if (act.blend <= 0) act.name = null; }
      const b = act.blend;
      JOINTS.forEach((n) => { const a = pose[n], c = poseB[n]; a[0] = lerp(a[0], c[0], b); a[1] = lerp(a[1], c[1], b); a[2] = lerp(a[2], c[2], b); });
      hipY = lerp(hipY, y, b); rootY *= b;
    }
    const calm = act.name ? 1 - act.blend : 1;                // how much idle life / look-at is allowed
    const br = Math.sin(time * 1.7);
    pose.Torso[0] += br * 0.012 * still * calm; pose.ArmL[2] += br * 0.02 * still * calm; pose.Coat[0] += Math.sin(time * 1.3) * 0.02;
    hipY += br * 0.022 * still * calm;
    const lk = cur.look * calm * still;
    pose.Head[1] += clamp(env.px, -1, 1) * 0.45 * lk; pose.Head[0] += clamp(env.py, -1, 1) * 0.22 * lk; pose.Torso[1] += clamp(env.px, -1, 1) * 0.1 * lk;

    JOINTS.forEach((n) => { const a = pose[n]; e.set(a[0], a[1], a[2], 'YXZ'); J[n].quaternion.setFromEuler(e); });
    J.Hips.position.set(rest.Hips.p.x, rest.Hips.p.y + hipY, rest.Hips.p.z);

    // springs
    fxs.squashV += (-fxs.squash * 190 - fxs.squashV * 13) * dt; fxs.squash += fxs.squashV * dt;
    fxs.burstV += (-fxs.burst * 60 - fxs.burstV * 7) * dt; fxs.burst += fxs.burstV * dt;
    fxs.hairV += (-fxs.hair * 150 - fxs.hairV * 9) * dt; fxs.hair += fxs.hairV * dt;
    fxs.shake = damp(fxs.shake, 0, 7, dt);
    J.Hair.scale.set(1 - fxs.hair * 0.12, 1 + fxs.hair * 0.22, 1 - fxs.hair * 0.12);
    root.rotation.y = cur.turn + env.dragYaw; root.position.y = rootY;
    root.scale.set(1 - fxs.squash * 0.3, 1 + fxs.squash, 1 - fxs.squash * 0.3);

    // ---- camera ----
    const dist = (MODEL_H / Math.max(0.05, cur.fh)) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2));
    const yaw = cur.yaw + env.px * 0.05, pitch = cur.pitch - env.py * 0.02, sh = fxs.shake * fxs.shake;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, TARGET_Y + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(0, TARGET_Y, 0);
    camera.setViewOffset(W, H, (0.5 - cur.fx) * W + Math.sin(time * 71) * sh * 15, (0.5 - cur.fy) * H + Math.cos(time * 83) * sh * 15, W, H);

    // ---- lights ----
    rimU.uRimColor.value.copy(RED).lerp(BONE, cur.light); rimU.uRimPower.value = 0.3 - cur.light * 0.12;
    rim.color.copy(RED).lerp(BONE, cur.light); rim.intensity = 8.5 - cur.light * 5.5; kick.intensity = 2.4 - cur.light * 1.2; under.intensity = 7 * (1 - cur.light * 0.8);

    // ---- pad / shock ----
    const on = landed ? 1 : 0;
    padU.uTime.value = time; padU.uOpacity.value = cur.pad * on; padU.uColor.value.copy(RED).lerp(BONE, cur.light * 0.85);
    catcher.material.opacity = 0.55 * cur.pad;
    shocks.forEach((m, i) => {
      const t = fxs.shockT - i * 0.09;
      if (fxs.shockT < 0 || t < 0 || t > 0.9) { m.material.opacity = 0; return; }
      const k = t / 0.9; m.scale.setScalar(1 + (1 - Math.pow(1 - k, 3)) * (i ? 12 : 8)); m.material.opacity = (1 - k) * 0.9; m.material.color.copy(i ? RED : BONE);
    });
    if (fxs.shockT >= 0) { fxs.shockT += dt; if (fxs.shockT > 1.2) fxs.shockT = -1; }

    // ---- ambient ----
    const fx = cur.fx3d * on;
    stars.forEach((sp) => {
      const u = sp.userData, tw = 0.6 + Math.sin(time * 2.2 + u.ph) * 0.4;
      sp.position.copy(u.base); sp.position.y += Math.sin(time * 0.5 + u.ph) * 0.3;
      sp.scale.setScalar(u.s * tw * fx); sp.material.rotation = Math.sin(time * 0.7 + u.ph) * 0.4; sp.visible = fx > 0.02;
    });
    embU.uTime.value = time; embU.uOpacity.value = fx * 0.8; embU.uScale.value = renderer.getPixelRatio(); embU.uBurst.value = Math.max(0, fxs.burst);
    embU.uColor.value.set('#ff3b2a').lerp(BONE, cur.light * 0.7);
    bolts.forEach((b) => {
      const u = b.userData; if (u.t === -1) { b.material.opacity = 0; return; }
      u.t += dt; const k = u.t / 0.3;
      b.material.opacity = k < 0 || k > 1 ? 0 : (k < 0.25 ? 1 : k < 0.4 ? 0.1 : k < 0.6 ? 0.9 : 1 - k); if (k > 1) u.t = -1;
    });
    lineMat.opacity = cur.run * 0.5; lineMatR.opacity = cur.run * 0.75;
    lines.forEach((m) => { m.visible = cur.run > 0.01; if (!m.visible) return; const u = m.userData; u.z -= u.v * dt; if (u.z < -22) u.z += 44; m.position.set(u.x, u.y, u.z); });
    if (fxs.slashT >= 0) {
      fxs.slashT += dt; const t = fxs.slashT;
      arcU.uProg.value = clamp(t / 0.08) * 1.05; arcU.uFade.value = t < 0.12 ? 1 : clamp(1 - (t - 0.12) / 0.45); arc.visible = true;
      if (t > 0.62) { fxs.slashT = -1; arc.visible = false; }
    }
    const st = cur.storm; storm.visible = st > 0.01;
    if (storm.visible) cards.forEach((g) => {
      const u = g.userData, a = u.a + time * 0.22 + st * 1.4, s = 1 - Math.pow(1 - clamp((st - u.k * 0.55) / 0.4), 3);
      g.position.set(Math.sin(a) * u.r, u.y + Math.sin(time * 0.9 + u.a * 3) * 0.18, Math.cos(a) * u.r);
      g.rotation.set(0, yaw + Math.sin(a - yaw) * 0.55, u.tilt);
      g.scale.set(Math.max(0.0001, u.h * u.w * s), Math.max(0.0001, u.h * s), 1);
    });

    renderer.render(scene, camera);
  }

  return { frame, resize, play, skipIntro, loadClips, get busy() { return !!act.name; }, get landed() { return landed; }, _dev: { J, P, THREE } };
}

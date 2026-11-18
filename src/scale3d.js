import * as THREE from 'three';

// The scale object: a 10 x 10 x 10 block of unit cubes.
// One ink cube stands for a $10K month. Growth is "times ten", three times:
// a row of ten, a floor of a hundred, a block of a thousand.
// A single number, grow (0..3), drives all of it in the vertex shader.

import { N, EXTRUDE, cellPlan } from './scale-model.js';

const rad = THREE.MathUtils.degToRad;
const smooth = (x) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};

const VERT = /* glsl */ `
  attribute vec3 aCell;
  attribute float aOrder;
  attribute float aAxis;

  uniform float uGrow;
  uniform float uUnit;
  uniform float uPeek;

  varying vec2 vUv;
  varying vec3 vN;
  varying float vInk;

  void main() {
    float s = clamp((uGrow - aOrder) / ${EXTRUDE.toFixed(2)}, 0.0, 1.0);
    s = 1.0 - pow(1.0 - s, 3.0);

    vec3 p = position; // -0.5..0.5
    if (aAxis < 0.5) {
      s = uUnit;
      p.xz *= s;
      p.y = (p.y + 0.5) * s - 0.5;
    } else if (aAxis < 1.5) {
      p.x = (p.x + 0.5) * s - 0.5; // slides out of the cube to its left
    } else if (aAxis < 2.5) {
      p.z = 0.5 - (0.5 - p.z) * s; // slides out of the row in front
    } else {
      // The first cube of the next layer can peek up as a scroll cue.
      if (aCell.x < 0.5 && aCell.z < 0.5 && aCell.y > 0.5 && aCell.y < 1.5) s = max(s, 0.3 * uPeek);
      p.y = (p.y + 0.5) * s - 0.5; // rises out of the layer below
    }
    if (s < 0.001) p = vec3(0.0); // not born yet: collapse to a point

    vec3 w = vec3(aCell.x + 0.5, aCell.y + 0.5, -(aCell.z + 0.5)) + p;
    vUv = uv;
    vN = normal;
    vInk = aAxis < 0.5 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uFront;
  uniform vec3 uSide;
  uniform vec3 uEdge;
  uniform vec3 uInkTop;
  uniform vec3 uInkFront;
  uniform vec3 uInkSide;
  uniform vec3 uInkEdge;
  uniform float uLine;

  varying vec2 vUv;
  varying vec3 vN;
  varying float vInk;

  void main() {
    vec3 n = abs(vN);
    vec3 paper = n.y > 0.5 ? uTop : (n.z > 0.5 ? uFront : uSide);
    vec3 ink = n.y > 0.5 ? uInkTop : (n.z > 0.5 ? uInkFront : uInkSide);

    // Hairline on every face border, constant width on screen.
    vec2 d = min(vUv, 1.0 - vUv) / max(fwidth(vUv) * uLine, vec2(1e-5));
    float line = 1.0 - smoothstep(0.0, 1.0, min(d.x, d.y));

    vec3 col = mix(mix(paper, uEdge, line), mix(ink, uInkEdge, line), vInk);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SHADOW_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec4 vClip;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
    vClip = gl_Position;
  }
`;

const SHADOW_FRAG = /* glsl */ `
  uniform vec3 uShadow;
  uniform vec2 uExtent; // footprint: x 0..uExtent.x, z -uExtent.y..0
  uniform float uUnit;
  varying vec3 vWorld;
  varying vec4 vClip;

  void main() {
    // Distance outside the footprint, nudged back and to the right of the block.
    vec2 q = vec2(vWorld.x - 0.3, -vWorld.z - 0.3);
    vec2 o = max(max(-q, q - uExtent), vec2(0.0));
    float dist = length(o);
    float a = 0.14 * pow(1.0 - smoothstep(0.0, 1.7, dist), 1.6) * uUnit;
    // Fade out toward the canvas border, so the shadow never ends in a hard edge.
    vec2 e = 1.0 - abs(vClip.xy / vClip.w);
    a *= smoothstep(0.0, 0.12, min(e.x, e.y));
    gl_FragColor = vec4(uShadow * a, a);
    #include <colorspace_fragment>
  }
`;

// sway: a slow drift of the camera. Without it the scene is only redrawn when something changes.
export function createScale(canvas, { onLost, sway = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  const target = new THREE.Vector3();

  // 1,000 instances of one box, one draw call.
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.copy(new THREE.BoxGeometry(1, 1, 1));
  geometry.instanceCount = N * N * N;

  const cells = new Float32Array(N * N * N * 3);
  const orders = new Float32Array(N * N * N);
  const axes = new Float32Array(N * N * N);
  let i = 0;
  for (let iy = 0; iy < N; iy++)
    for (let iz = 0; iz < N; iz++)
      for (let ix = 0; ix < N; ix++) {
        const { axis, order } = cellPlan(ix, iy, iz);
        cells.set([ix, iy, iz], i * 3);
        orders[i] = order;
        axes[i] = axis;
        i++;
      }
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 3));
  geometry.setAttribute('aOrder', new THREE.InstancedBufferAttribute(orders, 1));
  geometry.setAttribute('aAxis', new THREE.InstancedBufferAttribute(axes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uGrow: { value: 0 },
      uUnit: { value: 0 },
      uPeek: { value: 0 },
      uLine: { value: 1 },
      uTop: { value: new THREE.Color('#ffffff') },
      uFront: { value: new THREE.Color('#f3f6fd') },
      uSide: { value: new THREE.Color('#e3e9f7') },
      uEdge: { value: new THREE.Color('#bdc8e6') },
      // The one cube that stands for the brand today, in the brand blue
      uInkTop: { value: new THREE.Color('#6585ff') },
      uInkFront: { value: new THREE.Color('#2453ff') },
      uInkSide: { value: new THREE.Color('#1739d1') },
      uInkEdge: { value: new THREE.Color('#9fb4ff') },
    },
  });

  const block = new THREE.Mesh(geometry, material);
  block.frustumCulled = false; // bounds ignore the per-instance offsets

  const shadowMaterial = new THREE.ShaderMaterial({
    vertexShader: SHADOW_VERT,
    fragmentShader: SHADOW_FRAG,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    uniforms: {
      uShadow: { value: new THREE.Color('#0b1a5c') },
      uExtent: { value: new THREE.Vector2(1, 1) },
      uUnit: { value: 0 },
    },
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(5, -0.002, -5);
  shadow.renderOrder = -1;

  scene.add(shadow, block);

  const state = { grow: 0, unit: 0, peek: 0, px: 0, py: 0, tx: 0, ty: 0 };
  let width = 0;
  let height = 0;
  let ratio = 0;
  let dirty = true; // something changed since the last frame

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // Checked every frame, so zooming or moving the window to another screen re-renders sharply.
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 960 ? 1.75 : 2);
    if (!w || !h || (w === width && h === height && dpr === ratio)) return;
    width = w;
    height = h;
    ratio = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Never thinner than three quarters of a device pixel, or the lines shimmer on 1x screens.
    material.uniforms.uLine.value = Math.max(0.75, 0.6 * dpr);
    dirty = true;
  }

  function render(seconds = 0, drifting = true) {
    resize();
    const g = state.grow;
    const g1 = smooth(g);
    const g2 = smooth(g - 1);
    const g3 = smooth(g - 2);
    const ex = 1 + 9 * g1;
    const ez = 1 + 9 * g2;
    const ey = 1 + 9 * g3;

    material.uniforms.uGrow.value = g;
    material.uniforms.uUnit.value = state.unit;
    material.uniforms.uPeek.value = state.peek;
    shadowMaterial.uniforms.uExtent.value.set(ex, ez);
    shadowMaterial.uniforms.uUnit.value = Math.min(1, state.unit);

    // Fit the camera to the block as it grows, so it has to back away.
    target.set(ex / 2, ey / 2, -ez / 2);
    const radius = Math.max(2.4, 0.5 * Math.hypot(ex, ey, ez));
    const half = Math.atan(Math.tan(rad(13)) * Math.min(1, camera.aspect));
    const dist = (radius / Math.sin(half)) * 1.08;

    // Ease the pointer lean.
    state.px += (state.tx - state.px) * 0.06;
    state.py += (state.ty - state.py) * 0.06;

    const drift = drifting ? 2.5 * Math.sin((seconds * 2 * Math.PI) / 14) : 0;
    const az = rad(-30 - 12 * g3 + drift) + state.px;
    const el = rad(32 - 8 * g3) + state.py;
    camera.position.set(
      target.x + dist * Math.sin(az) * Math.cos(el),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(az) * Math.cos(el)
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  // The loop runs only while the canvas is on screen and the tab is visible.
  let raf = 0;
  let running = false;
  let onScreen = true;
  const started = performance.now();
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    // The pointer lean eases toward its target, so keep drawing until it has settled.
    const leaning = Math.abs(state.tx - state.px) > 1e-4 || Math.abs(state.ty - state.py) > 1e-4;
    if (!sway && !dirty && !leaning) return;
    dirty = false;
    render((now - started) / 1000, sway);
  };
  function sync() {
    const should = running && onScreen && !document.hidden;
    if (should && !raf) raf = requestAnimationFrame(tick);
    if (!should && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', sync);

  const ro = new ResizeObserver(() => {
    dirty = true;
    if (!raf) render(0, false);
  });
  ro.observe(canvas);

  const lost = (event) => {
    event.preventDefault();
    api.stop();
    if (onLost) onLost();
  };
  canvas.addEventListener('webglcontextlost', lost);

  const api = {
    set(grow, unit = 1) {
      state.grow = Math.min(3, Math.max(0, grow));
      state.unit = Math.max(0, unit);
      dirty = true;
    },
    peek(value) {
      state.peek = value;
      dirty = true;
    },
    // x, y in -1..1 across the stage
    pointer(x, y) {
      state.tx = rad(3) * x;
      state.ty = rad(1.5) * y;
    },
    start() {
      running = true;
      sync();
    },
    stop() {
      running = false;
      sync();
    },
    renderOnce() {
      render(0, false);
    },
    dispose() {
      api.stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('webglcontextlost', lost);
      geometry.dispose();
      material.dispose();
      shadow.geometry.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
    },
  };
  return api;
}

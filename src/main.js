import * as m from "./math.js";

const jp = m.makeJprcs(window.proj4);

const BLOG_URL = "https://tsute.jumboly.jp/posts/map-by-arithmetic/";
const VIEW = { width: 640, height: 480 };

const PLACES = [
  { name: "大阪", lon: 135.5023, lat: 34.6937 },
  { name: "東京駅", lon: 139.7671, lat: 35.6812 },
  { name: "ロンドン", lon: -0.1276, lat: 51.5072 },
  { name: "シドニー", lon: 151.2093, lat: -33.8688 },
  { name: "レイキャビク", lon: -21.9426, lat: 64.1466 },
  { name: "第VI系の原点", lon: 136, lat: 36 },
];

// data/osaka_bay_coastline.geojson を切り出した範囲（西, 南, 東, 北）。scripts/build-data.sh と合わせる
const OSAKA_BBOX = [134.65, 34.1, 135.55, 34.8];

const SCALES =[1000, 10000, 25000, 100000, 250000, 1000000, 2500000, 10000000, 50000000, 200000000];

// ---- 表示用の小道具 ----

const f = (n, d = 2) =>
  n.toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d });
// 式に代入した値を見せるとき、負の数を括弧で包まないと「− −」が並んで読みにくい
const p = (n, d = 2) => (n < 0 ? `(${f(n, d)})` : f(n, d));
const kText = (k) => {
  const d = Math.max(0, Math.min(8, Math.ceil(-Math.log10(k)) + 2));
  return k.toLocaleString("ja-JP", { maximumFractionDigits: d });
};

// ---- 平面 → 画面の倍率の決め方（第3章・第5章で共通） ----

const scaleControls = [
  {
    key: "basis",
    label: "倍率の決め方",
    type: "select",
    options: [
      ["ppm", "1mを何ピクセルにするかを直接決める"],
      ["scale", "縮尺と、1mmを何ピクセルにするかで決める"],
    ],
  },
  {
    key: "ppm",
    label: "1mを何ピクセルにするか",
    type: "log",
    min: -6,
    max: 1,
    step: 0.05,
    when: (st) => st.basis === "ppm",
    show: (v) => `1 m = ${kText(v)} px（1 px = ${kText(1 / v)} m）`,
  },
  {
    key: "scale",
    label: "縮尺",
    type: "select",
    options: SCALES.map((s) => [String(s), `1 : ${s.toLocaleString("ja-JP")}`]),
    when: (st) => st.basis === "scale",
  },
  {
    key: "pxmm",
    label: "紙の上の1mmを何ピクセルにするか",
    type: "range",
    min: 1,
    max: 8,
    step: 0.1,
    when: (st) => st.basis === "scale",
    show: (v) => `1 mm = ${f(v, 1)} px（1インチに直すと ${f(m.dpiFromPxPerMm(v), 1)} px。これが DPI（PPI））`,
  },
];

const pxPerMeter = (st) =>
  st.basis === "scale" ? m.pxPerMeterFromScale(st.scale, st.pxmm) : st.ppm;

function scaleRuleRows(st) {
  const k = pxPerMeter(st);
  if (st.basis === "scale") {
    return [
      {
        g: "rule",
        label: "1m",
        expr: `縮尺 1:${st.scale.toLocaleString("ja-JP")} で 1 m は紙の上で ${kText(1000 / st.scale)} mm、1 mm = ${f(st.pxmm, 1)} px と決めたので 1 m = ${kText(k)} px`,
      },
    ];
  }
  return [{ g: "rule", label: "1m", expr: `1 m = ${kText(k)} px と決めた` }];
}

// ---- モード ----

const modes = {
  plate: {
    tab: "1. 緯度経度そのまま",
    title: "緯度経度をそのまま描く",
    lead: "経度をX、緯度をYとして、そのまま画面に並べます。投影法の数式は出てきません。正距円筒図法のいちばん単純な形です。",
    defaults: { s: 2, flip: 0 },
    controls: [
      {
        key: "s",
        label: "1度を何ピクセルにするか",
        type: "range",
        min: 1,
        max: 4,
        step: 0.5,
        show: (v) => `1度 = ${v} px（画面 ${360 * v} × ${180 * v}）`,
      },
      { key: "flip", label: "90から引くのをやめて、緯度に90を足してみる", type: "checkbox" },
    ],
    layers: ["world"],
    size: (st) => ({ width: 360 * st.s, height: 180 * st.s }),
    forward(lon, lat, st) {
      const r = m.plateToPixel(lon, lat, st.s);
      if (st.flip) r.py = (lat + 90) * st.s;
      return r;
    },
    inverse(px, py, st) {
      const r = m.pixelToPlate(px, py, st.s);
      if (st.flip) r.lat = py / st.s - 90;
      return r;
    },
    steps(lon, lat, st) {
      const { px, py } = this.forward(lon, lat, st);
      return [
        { g: "rule", label: "画面", expr: `1度 = ${st.s} px と決めた → 360度 × ${st.s} = ${360 * st.s} px、180度 × ${st.s} = ${180 * st.s} px` },
        { g: "px", label: "px", expr: `(lon + 180) × ${st.s} = (${p(lon, 4)} + 180) × ${st.s} = ${f(px)}` },
        st.flip
          ? { g: "px", label: "py", expr: `(lat + 90) × ${st.s} = (${p(lat, 4)} + 90) × ${st.s} = ${f(py)}　← 北が下になる` }
          : { g: "px", label: "py", expr: `(90 − lat) × ${st.s} = (90 − ${p(lat, 4)}) × ${st.s} = ${f(py)}` },
      ];
    },
    decorate(ctx, st) {
      drawGraticule(ctx, this, st, { lonStep: 30, latStep: 30, latMax: 90 });
    },
  },

  mercator: {
    tab: "2. Webメルカトル",
    title: "Webメルカトルで描く",
    lead: "緯度経度を、まず0〜1の正方形の座標にします。Yの式は公式として使います。正方形を何ピクセルにするかは、別に決めます。",
    defaults: { size: 256 },
    controls: [
      {
        key: "size",
        label: "0〜1の正方形を何ピクセルにするか",
        type: "range",
        min: 128,
        max: 640,
        step: 64,
        show: (v) => `${v} × ${v} px`,
      },
    ],
    layers: ["world"],
    size: (st) => ({ width: st.size, height: st.size }),
    forward(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      return { px: u.x * st.size, py: u.y * st.size };
    },
    inverse(px, py, st) {
      return m.mercatorUnitInverse(px / st.size, py / st.size);
    },
    steps(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      return [
        { g: "proj", label: "x", expr: `(lon + 180) / 360 = (${p(lon, 4)} + 180) / 360 = ${f(u.x, 6)}` },
        { g: "proj", label: "y", expr: `(1 − asinh(tan(φ)) / π) / 2 = ${f(u.y, 6)}　（φ は緯度をラジアンにしたもの）` },
        { g: "rule", label: "画面", expr: `正方形 = ${st.size} × ${st.size} px と決めた` },
        { g: "px", label: "px", expr: `x × ${st.size} = ${f(u.x, 6)} × ${st.size} = ${f(u.x * st.size)}` },
        { g: "px", label: "py", expr: `y × ${st.size} = ${f(u.y, 6)} × ${st.size} = ${f(u.y * st.size)}` },
        ...(Math.abs(lat) > m.MERCATOR_MAX_LAT
          ? [{ g: "note", label: "注", expr: `緯度 ±${f(m.MERCATOR_MAX_LAT, 5)} 度より先は正方形に入らないので端に寄せています` }]
          : []),
      ];
    },
    decorate(ctx, st) {
      drawGraticule(ctx, this, st, { lonStep: 30, latStep: 20, latMax: 80 });
    },
  },

  meters: {
    tab: "3. メートルからピクセルへ",
    title: "平面座標をメートルにして描く",
    lead: "Webメルカトルの正方形を、地球の赤道の長さでメートルに直します（EPSG:3857）。メートルの座標が出ても、画面のどこに描くかはまだ決まっていません。画面の中心と倍率を決めます。ドラッグで中心を動かせます。",
    defaults: () => {
      const u = m.mercatorUnit(135.25, 34.45);
      const c = m.unitToMeters(u.x, u.y);
      return { basis: "ppm", ppm: 0.004, scale: 1000000, pxmm: 4, cx: round(c.mx), cy: round(c.my) };
    },
    controls: scaleControls,
    layers: ["world", "osaka"],
    size: () => VIEW,
    view(st) {
      return { ...VIEW, cx: st.cx, cy: st.cy, k: pxPerMeter(st) };
    },
    forward(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      const { mx, my } = m.unitToMeters(u.x, u.y);
      return m.planeToScreen(mx, my, this.view(st));
    },
    inverse(px, py, st) {
      const { east, north } = m.screenToPlane(px, py, this.view(st));
      const u = m.metersToUnit(east, north);
      return m.mercatorUnitInverse(u.x, u.y);
    },
    pan(dx, dy, st) {
      const k = pxPerMeter(st);
      st.cx = round(st.cx - dx / k);
      st.cy = round(st.cy + dy / k);
    },
    center(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      const c = m.unitToMeters(u.x, u.y);
      st.cx = round(c.mx);
      st.cy = round(c.my);
    },
    steps(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      const { mx, my } = m.unitToMeters(u.x, u.y);
      const v = this.view(st);
      const { px, py } = m.planeToScreen(mx, my, v);
      const L = f(m.EARTH_CIRCUMFERENCE);
      return [
        { g: "proj", label: "x, y", expr: `正方形の座標（第2章）= ${f(u.x, 6)}, ${f(u.y, 6)}` },
        { g: "proj", label: "mx", expr: `(x − 0.5) × ${L} = ${f(mx)} m` },
        { g: "proj", label: "my", expr: `(0.5 − y) × ${L} = ${f(my)} m` },
        { g: "rule", label: "中心", expr: `画面の中心 (${v.width / 2}, ${v.height / 2}) に (${f(st.cx, 0)}, ${f(st.cy, 0)}) を置くと決めた` },
        ...scaleRuleRows(st),
        { g: "px", label: "px", expr: `${v.width / 2} + (mx − ${p(st.cx, 0)}) × ${kText(v.k)} = ${f(px)}` },
        { g: "px", label: "py", expr: `${v.height / 2} − (my − ${p(st.cy, 0)}) × ${kText(v.k)} = ${f(py)}` },
        {
          g: "note",
          label: "注",
          expr: `この緯度では、投影座標の 1 m は地表の約 ${f(m.mercatorGroundRatio(lat), 2)} m（メルカトルは高緯度ほど引き伸ばされる）`,
        },
      ];
    },
    decorate(ctx, st) {
      drawGraticule(ctx, this, st, { lonStep: 10, latStep: 10, latMax: 80 });
      drawScaleBar(ctx, pxPerMeter(st), "投影座標上");
    },
  },

  tiles: {
    tab: "4. XYZタイル",
    title: "XYZタイルで描く",
    lead: "ズーム0で世界全体を256×256ピクセルにし、ズームが1増えるごとに縦横を2倍にする、と決めた方式です。世界を256ピクセル四方のタイルに切り分けます。ドラッグで動かせます。",
    defaults: () => {
      const u = m.mercatorUnit(135.5023, 34.6937);
      return { z: 3, cx: roundU(u.x), cy: roundU(u.y) };
    },
    controls: [
      { key: "z", label: "ズームレベル", type: "range", min: 0, max: 16, step: 1, show: (v) => `z = ${v}（世界 = ${m.worldSize(v).toLocaleString("ja-JP")} px 四方）` },
    ],
    layers: ["world", "osaka"],
    size: () => VIEW,
    toScreen(x, y, st) {
      const size = m.worldSize(st.z);
      return { px: VIEW.width / 2 + (x - st.cx) * size, py: VIEW.height / 2 + (y - st.cy) * size };
    },
    forward(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      return this.toScreen(u.x, u.y, st);
    },
    inverse(px, py, st) {
      const size = m.worldSize(st.z);
      return m.mercatorUnitInverse(st.cx + (px - VIEW.width / 2) / size, st.cy + (py - VIEW.height / 2) / size);
    },
    pan(dx, dy, st) {
      const size = m.worldSize(st.z);
      st.cx = roundU(clamp(st.cx - dx / size, 0, 1));
      st.cy = roundU(clamp(st.cy - dy / size, 0, 1));
    },
    center(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      st.cx = roundU(u.x);
      st.cy = roundU(u.y);
    },
    steps(lon, lat, st) {
      const u = m.mercatorUnit(lon, lat);
      const t = m.tileOf(u.x, u.y, st.z);
      return [
        { g: "proj", label: "x, y", expr: `正方形の座標（第2章）= ${f(u.x, 6)}, ${f(u.y, 6)}　← ズームを変えても変わらない` },
        { g: "rule", label: "世界", expr: `256 × 2^${st.z} = ${t.size.toLocaleString("ja-JP")} px 四方と決めた` },
        { g: "px", label: "px", expr: `x × ${t.size.toLocaleString("ja-JP")} = ${f(t.px)}` },
        { g: "px", label: "py", expr: `y × ${t.size.toLocaleString("ja-JP")} = ${f(t.py)}` },
        { g: "px", label: "tile", expr: `floor(px / 256) = ${t.tileX}、floor(py / 256) = ${t.tileY}` },
        { g: "px", label: "タイル内", expr: `px − ${t.tileX} × 256 = ${f(t.innerX)}、py − ${t.tileY} × 256 = ${f(t.innerY)}` },
        { g: "note", label: "URL", expr: `タイル画像なら …/{z}/{x}/{y}.png → …/${st.z}/${t.tileX}/${t.tileY}.png` },
      ];
    },
    decorate(ctx, st) {
      drawTileGrid(ctx, this, st);
    },
  },

  jprcs: {
    tab: "5. 平面直角座標系",
    title: "平面直角座標系で描く",
    lead: "日本の測量で使う平面直角座標系の第VI系（原点は北緯36度・東経136度）です。投影の計算は proj4js に任せます。測量の X は北向き、Y は東向きなので、画面の軸と入れ替えて描きます。ドラッグで動かせます。",
    defaults: () => {
      const c = jp.forward(135.15, 34.45);
      return { basis: "ppm", ppm: 0.005, scale: 1000000, pxmm: 4, cX: round(c.X), cY: round(c.Y), overlay: 0 };
    },
    controls: [
      ...scaleControls,
      { key: "overlay", label: "緯度経度をそのまま並べた形を重ねる（緯度も経度も1度 = 111 km として）", type: "checkbox" },
    ],
    layers: ["osaka"],
    size: () => VIEW,
    // 画面の右 = Y（東）、画面の上 = X（北）。planeToScreen は (東, 北) を受け取るので Y, X の順に渡す
    view(st) {
      return { ...VIEW, cx: st.cY, cy: st.cX, k: pxPerMeter(st) };
    },
    forward(lon, lat, st) {
      const { X, Y } = jp.forward(lon, lat);
      return m.planeToScreen(Y, X, this.view(st));
    },
    inverse(px, py, st) {
      const { east, north } = m.screenToPlane(px, py, this.view(st));
      return jp.inverse(north, east);
    },
    pan(dx, dy, st) {
      const k = pxPerMeter(st);
      st.cY = round(st.cY - dx / k);
      st.cX = round(st.cX + dy / k);
    },
    center(lon, lat, st) {
      const c = jp.forward(lon, lat);
      st.cX = round(c.X);
      st.cY = round(c.Y);
    },
    steps(lon, lat, st) {
      const { X, Y } = jp.forward(lon, lat);
      const v = this.view(st);
      const { px, py } = m.planeToScreen(Y, X, v);
      return [
        { g: "proj", label: "X（北）", expr: `proj4js で第VI系に変換 → ${f(X)} m` },
        { g: "proj", label: "Y（東）", expr: `proj4js で第VI系に変換 → ${f(Y)} m` },
        { g: "rule", label: "軸", expr: "画面の右 = Y（東）、画面の上 = X（北）と対応させる" },
        { g: "rule", label: "中心", expr: `画面の中心 (${v.width / 2}, ${v.height / 2}) に (X, Y) = (${f(st.cX, 0)}, ${f(st.cY, 0)}) を置くと決めた` },
        ...scaleRuleRows(st),
        { g: "px", label: "px", expr: `${v.width / 2} + (Y − ${p(st.cY, 0)}) × ${kText(v.k)} = ${f(px)}` },
        { g: "px", label: "py", expr: `${v.height / 2} − (X − ${p(st.cX, 0)}) × ${kText(v.k)} = ${f(py)}` },
        { g: "note", label: "注", expr: "第VI系は京都府・大阪府・福井県・滋賀県・三重県・奈良県・和歌山県のための座標系。中央の経線（東経136度）から東西に離れるほど縮尺の誤差が大きくなる" },
      ];
    },
    decorate(ctx, st) {
      drawJprcsAxes(ctx, this, st);
      if (st.overlay) drawPlateOverlay(ctx, this, st);
      drawScaleBar(ctx, pxPerMeter(st), "平面直角座標上");
    },
  },
};

// ---- 状態と URL ----

// 記事の各章から「この設定の教材」に直接リンクできるよう、状態はすべて URL に持たせる
function readState() {
  const q = new URLSearchParams(location.search);
  const mode = modes[q.get("mode")] ? q.get("mode") : "plate";
  const def = modes[mode].defaults;
  const st = { ...(typeof def === "function" ? def() : def) };
  for (const key of Object.keys(st)) {
    if (!q.has(key)) continue;
    const raw = q.get(key);
    st[key] = typeof st[key] === "number" ? Number(raw) : raw;
    if (Number.isNaN(st[key])) st[key] = (typeof def === "function" ? def() : def)[key];
  }
  const lon = Number(q.get("lon"));
  const lat = Number(q.get("lat"));
  const probe = q.has("lon") && q.has("lat") && !Number.isNaN(lon) && !Number.isNaN(lat)
    ? { lon, lat }
    : { lon: PLACES[0].lon, lat: PLACES[0].lat };
  return { mode, st, probe };
}

function writeState() {
  const q = new URLSearchParams({ mode: state.mode });
  for (const [key, value] of Object.entries(state.st)) q.set(key, String(value));
  q.set("lon", state.probe.lon.toFixed(4));
  q.set("lat", state.probe.lat.toFixed(4));
  history.replaceState(null, "", `?${q}`);
}

const round = (n) => Math.round(n);
const roundU = (n) => Math.round(n * 1e8) / 1e8;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ---- 描画 ----

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const data = {};

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function strokeLine(ctx, points) {
  ctx.beginPath();
  points.forEach(({ px, py }, i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
}

function drawGraticule(ctx, mode, st, { lonStep, latStep, latMax }) {
  ctx.save();
  ctx.strokeStyle = css("--grid");
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += lonStep) {
    const pts = [];
    for (let lat = -latMax; lat <= latMax; lat += 2) pts.push(mode.forward(lon, lat, st));
    strokeLine(ctx, pts);
  }
  for (let lat = -latMax; lat <= latMax; lat += latStep) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push(mode.forward(lon, lat, st));
    strokeLine(ctx, pts);
  }
  ctx.restore();
}

function drawTileGrid(ctx, mode, st) {
  const size = m.worldSize(st.z);
  const n = 2 ** st.z;
  const left = mode.toScreen(0, 0, st);
  const x0 = Math.max(0, Math.floor((st.cx * size - VIEW.width / 2) / 256));
  const x1 = Math.min(n - 1, Math.floor((st.cx * size + VIEW.width / 2) / 256));
  const y0 = Math.max(0, Math.floor((st.cy * size - VIEW.height / 2) / 256));
  const y1 = Math.min(n - 1, Math.floor((st.cy * size + VIEW.height / 2) / 256));
  const u = m.mercatorUnit(state.probe.lon, state.probe.lat);
  const t = m.tileOf(u.x, u.y, st.z);
  ctx.save();
  ctx.fillStyle = css("--tile-hit");
  ctx.fillRect(left.px + t.tileX * 256, left.py + t.tileY * 256, 256, 256);
  ctx.strokeStyle = css("--grid-strong");
  ctx.fillStyle = css("--muted");
  ctx.font = "12px ui-monospace, monospace";
  ctx.lineWidth = 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const sx = left.px + tx * 256;
      const sy = left.py + ty * 256;
      ctx.strokeRect(sx + 0.5, sy + 0.5, 256, 256);
      ctx.fillText(`${st.z}/${tx}/${ty}`, sx + 6, sy + 16);
    }
  }
  ctx.restore();
}

function drawJprcsAxes(ctx, mode, st) {
  const o = m.planeToScreen(0, 0, mode.view(st));
  ctx.save();
  ctx.strokeStyle = css("--grid-strong");
  ctx.fillStyle = css("--muted");
  ctx.font = "12px ui-monospace, monospace";
  ctx.setLineDash([4, 4]);
  strokeLine(ctx, [{ px: o.px, py: 0 }, { px: o.px, py: VIEW.height }]);
  strokeLine(ctx, [{ px: 0, py: o.py }, { px: VIEW.width, py: o.py }]);
  ctx.setLineDash([]);
  if (o.px > 0 && o.px < VIEW.width) ctx.fillText("X = 0 の線（Y軸）", o.px + 4, 16);
  if (o.py > 0 && o.py < VIEW.height) ctx.fillText("Y = 0 の線（X軸）", 6, o.py - 6);
  if (o.px > 0 && o.px < VIEW.width && o.py > 0 && o.py < VIEW.height) {
    ctx.beginPath();
    ctx.arc(o.px, o.py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("原点 北緯36度・東経136度", o.px + 6, o.py + 16);
  }
  ctx.restore();
}

// 第1章の描き方（緯度と経度を同じ倍率で並べる）を同じ場所・同じ倍率で重ね、形の違いを見せる
function drawPlateOverlay(ctx, mode, st) {
  const DEG = 111000;
  const center = jp.inverse(st.cX, st.cY);
  const view = mode.view(st);
  ctx.save();
  ctx.strokeStyle = css("--overlay");
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  for (const line of data.osaka) {
    strokeLine(ctx, line.map(([lon, lat]) =>
      m.planeToScreen(st.cY + (lon - center.lon) * DEG, st.cX + (lat - center.lat) * DEG, view)));
  }
  ctx.restore();
}

function niceLength(target) {
  const e = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((s) => s * e).find((v) => v >= target) ?? 10 * e;
}

function drawScaleBar(ctx, k, note) {
  const meters = niceLength(100 / k);
  const len = meters * k;
  const x = 16;
  const y = VIEW.height - 20;
  ctx.save();
  ctx.strokeStyle = css("--fg");
  ctx.fillStyle = css("--fg");
  ctx.lineWidth = 2;
  strokeLine(ctx, [{ px: x, py: y - 5 }, { px: x, py: y }, { px: x + len, py: y }, { px: x + len, py: y - 5 }]);
  ctx.font = "12px system-ui, sans-serif";
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  ctx.fillText(`${label}（${note}）`, x, y - 8);
  ctx.restore();
}

function drawProbe(ctx, mode, st) {
  const { px, py } = mode.forward(state.probe.lon, state.probe.lat, st);
  ctx.save();
  ctx.strokeStyle = css("--probe");
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.stroke();
  strokeLine(ctx, [{ px: px - 12, py }, { px: px + 12, py }]);
  strokeLine(ctx, [{ px, py: py - 12 }, { px, py: py + 12 }]);
  ctx.restore();
}

function draw() {
  const mode = modes[state.mode];
  const st = state.st;
  const { width, height } = mode.size(st);
  // 物理ピクセルが多い画面でもにじまないよう、内部の解像度だけ devicePixelRatio 倍にする。
  // 計算と表示に使うのは CSS の論理ピクセルのまま。
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.aspectRatio = `${width} / ${height}`;
  canvas.style.maxWidth = `${width}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = css("--canvas");
  ctx.fillRect(0, 0, width, height);
  mode.decorate?.(ctx, st);
  ctx.strokeStyle = css("--coast");
  ctx.lineWidth = 1.2;
  for (const layer of mode.layers) {
    ctx.save();
    // 大阪湾は詳しいデータを別に持っているので、粗い世界の海岸線はその範囲だけ描かない
    if (layer === "world" && mode.layers.includes("osaka")) {
      const a = mode.forward(OSAKA_BBOX[0], OSAKA_BBOX[3], st);
      const b = mode.forward(OSAKA_BBOX[2], OSAKA_BBOX[1], st);
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.rect(a.px, a.py, b.px - a.px, b.py - a.py);
      ctx.clip("evenodd");
    }
    for (const line of data[layer]) strokeLine(ctx, line.map(([lon, lat]) => mode.forward(lon, lat, st)));
    ctx.restore();
  }
  drawProbe(ctx, mode, st);
  const shown = canvas.getBoundingClientRect().width;
  document.getElementById("canvas-size").textContent =
    `画面 ${width} × ${height} px${shown && shown < width - 1 ? "（縮めて表示中）" : ""}`;
}

// ---- パネル ----

const GROUP_LABEL = {
  in: "入力（緯度経度）",
  proj: "投影後の座標　表示条件を変えても変わらない",
  rule: "決め打ち",
  px: "ピクセル座標　表示条件で変わる",
  note: "補足",
};

let lastValues = {};

function renderSteps() {
  const mode = modes[state.mode];
  const { lon, lat } = state.probe;
  const rows = [
    { g: "in", label: "lon, lat", expr: `経度 ${f(lon, 4)}、緯度 ${f(lat, 4)}` },
    ...mode.steps(lon, lat, state.st),
  ];
  const box = document.getElementById("steps");
  box.replaceChildren();
  let current = null;
  const values = {};
  for (const row of rows) {
    if (row.g !== current) {
      current = row.g;
      const h = document.createElement("div");
      h.className = `group group-${row.g}`;
      h.textContent = GROUP_LABEL[row.g];
      box.append(h);
    }
    const el = document.createElement("div");
    el.className = `step step-${row.g}`;
    const k = document.createElement("span");
    k.className = "label";
    k.textContent = row.label;
    const v = document.createElement("code");
    v.textContent = row.expr;
    el.append(k, v);
    // どの値が変わったかを目で追えるよう、前回と違う行だけ一瞬光らせる
    const id = `${row.g}:${row.label}`;
    values[id] = row.expr;
    if (id in lastValues && lastValues[id] !== row.expr) el.classList.add("changed");
    box.append(el);
  }
  lastValues = values;
}

function renderControls() {
  const mode = modes[state.mode];
  const box = document.getElementById("controls");
  box.replaceChildren();
  for (const c of mode.controls) {
    if (c.when && !c.when(state.st)) continue;
    const wrap = document.createElement("label");
    wrap.className = `control control-${c.type}`;
    const title = document.createElement("span");
    title.className = "control-title";
    title.textContent = c.label;
    const value = document.createElement("span");
    value.className = "control-value";
    let input;
    const val = state.st[c.key];
    if (c.type === "select") {
      input = document.createElement("select");
      for (const [v, text] of c.options) input.add(new Option(text, v, false, String(val) === v));
      input.addEventListener("change", () => {
        state.st[c.key] = typeof val === "number" ? Number(input.value) : input.value;
        update({ controls: true });
      });
    } else if (c.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(val);
      input.addEventListener("change", () => {
        state.st[c.key] = input.checked ? 1 : 0;
        update();
      });
    } else {
      input = document.createElement("input");
      input.type = "range";
      input.min = c.min;
      input.max = c.max;
      input.step = c.step;
      // 倍率は桁が大きく変わるので、スライダーは指数で動かす
      input.value = c.type === "log" ? Math.log10(val) : val;
      input.addEventListener("input", () => {
        const n = Number(input.value);
        state.st[c.key] = c.type === "log" ? Number((10 ** n).toPrecision(3)) : n;
        value.textContent = c.show(state.st[c.key]);
        update();
      });
      value.textContent = c.show(val);
    }
    if (c.type === "checkbox") wrap.append(input, title);
    else wrap.append(title, input, value);
    box.append(wrap);
  }
}

function renderPlaces() {
  const sel = document.getElementById("place");
  sel.replaceChildren(new Option("地点を選ぶ…", ""));
  PLACES.forEach((pl, i) => sel.add(new Option(pl.name, String(i))));
  sel.addEventListener("change", () => {
    if (sel.value === "") return;
    const pl = PLACES[Number(sel.value)];
    state.probe = { lon: pl.lon, lat: pl.lat };
    sel.value = "";
    update({ inputs: true });
  });
  const lon = document.getElementById("lon");
  const lat = document.getElementById("lat");
  const onInput = () => {
    const a = Number(lon.value);
    const b = Number(lat.value);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    state.probe = { lon: clamp(a, -180, 180), lat: clamp(b, -90, 90) };
    update();
  };
  lon.addEventListener("change", onInput);
  lat.addEventListener("change", onInput);
  document.getElementById("center").addEventListener("click", () => {
    const mode = modes[state.mode];
    mode.center?.(state.probe.lon, state.probe.lat, state.st);
    update();
  });
}

function renderMode() {
  const mode = modes[state.mode];
  document.getElementById("title").textContent = mode.title;
  document.getElementById("lead").textContent = mode.lead;
  document.getElementById("center").hidden = !mode.center;
  document.getElementById("pan-hint").hidden = !mode.pan;
  for (const a of document.querySelectorAll("#tabs a")) {
    a.setAttribute("aria-current", a.dataset.mode === state.mode ? "page" : "false");
  }
  lastValues = {};
  renderControls();
}

function update({ controls = false, inputs = true } = {}) {
  if (controls) renderControls();
  if (inputs) {
    document.getElementById("lon").value = state.probe.lon.toFixed(4);
    document.getElementById("lat").value = state.probe.lat.toFixed(4);
  }
  draw();
  renderSteps();
  writeState();
}

// ---- 操作 ----

function canvasPoint(e) {
  const mode = modes[state.mode];
  const { width } = mode.size(state.st);
  const rect = canvas.getBoundingClientRect();
  // 画面幅に合わせて縮んで表示されていても、計算上の座標に戻す
  const s = width / rect.width;
  return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s, s };
}

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const pt = canvasPoint(e);
  drag = { start: pt, last: pt, moved: false };
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const mode = modes[state.mode];
  const pt = canvasPoint(e);
  if (Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) > 4) drag.moved = true;
  if (drag.moved && mode.pan) {
    mode.pan(pt.x - drag.last.x, pt.y - drag.last.y, state.st);
    update({ inputs: false });
  }
  drag.last = pt;
});
canvas.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  if (moved) return;
  // ドラッグでなくクリックなら、その位置を逆算して調べる地点にする
  const pt = canvasPoint(e);
  const g = modes[state.mode].inverse(pt.x, pt.y, state.st);
  if (!Number.isFinite(g.lon) || !Number.isFinite(g.lat)) return;
  state.probe = { lon: clamp(g.lon, -180, 180), lat: clamp(g.lat, -90, 90) };
  update();
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => draw());

// ---- 起動 ----

function toLines(geojson) {
  return geojson.features.flatMap((feat) => {
    const g = feat.geometry;
    return g.type === "LineString" ? [g.coordinates] : g.coordinates;
  });
}

const state = readState();

async function main() {
  const [world, osaka] = await Promise.all(
    ["data/ne_110m_coastline.geojson", "data/osaka_bay_coastline.geojson"].map((u) => fetch(u).then((r) => r.json())),
  );
  data.world = toLines(world);
  data.osaka = toLines(osaka);
  const tabs = document.getElementById("tabs");
  for (const [key, mode] of Object.entries(modes)) {
    const a = document.createElement("a");
    a.href = `?mode=${key}`;
    a.dataset.mode = key;
    a.textContent = mode.tab;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      // 調べている地点は章をまたいで引き継ぎ、表示条件だけその章の既定に戻す
      state.mode = key;
      const def = modes[key].defaults;
      state.st = { ...(typeof def === "function" ? def() : def) };
      renderMode();
      update();
    });
    tabs.append(a);
  }
  document.getElementById("blog").href = BLOG_URL;
  renderPlaces();
  renderMode();
  update();
}

main();

// 座標計算だけを集めたモジュール。DOMに依存させないのは、Node.jsのテストで
// 画面を開かずに計算結果を確かめられるようにするため。

// ---- 第1章: 緯度経度をそのまま描く ----

// 経度 -180〜180 を 0〜360、緯度 90〜-90 を 0〜180 にずらしてから倍率を掛ける。
// 画面のYは下向きに増えるので、北が上に来るよう 90 から緯度を引く。
export function plateToPixel(lon, lat, pxPerDeg) {
  return {
    px: (lon + 180) * pxPerDeg,
    py: (90 - lat) * pxPerDeg,
  };
}

export function pixelToPlate(px, py, pxPerDeg) {
  return {
    lon: px / pxPerDeg - 180,
    lat: 90 - py / pxPerDeg,
  };
}

// ---- 第2章: Webメルカトル（0〜1の正方形） ----

// 正方形の端になる緯度。y = 0 になる緯度を逆算すると atan(sinh(π)) になる。
export const MERCATOR_MAX_LAT = (Math.atan(Math.sinh(Math.PI)) * 180) / Math.PI;

export function mercatorUnit(lon, lat) {
  // 極は無限遠に飛んでしまうので、正方形に収まる範囲に丸めておく
  const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
  const phi = (clamped * Math.PI) / 180;
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2,
  };
}

export function mercatorUnitInverse(x, y) {
  return {
    lon: x * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
  };
}

// ---- 第3章: EPSG:3857のメートル座標 ----

export const EARTH_RADIUS = 6378137; // WGS84の赤道半径
export const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS;

// 正方形の中心（経度0・赤道）を原点にし、北を正にするため Y の向きを反転する
export function unitToMeters(x, y) {
  return {
    mx: (x - 0.5) * EARTH_CIRCUMFERENCE,
    my: (0.5 - y) * EARTH_CIRCUMFERENCE,
  };
}

export function metersToUnit(mx, my) {
  return {
    x: mx / EARTH_CIRCUMFERENCE + 0.5,
    y: 0.5 - my / EARTH_CIRCUMFERENCE,
  };
}

// メルカトルは緯度が上がるほど引き伸ばされる。投影座標上の長さを地表の長さに直す係数。
export function mercatorGroundRatio(lat) {
  return Math.cos((lat * Math.PI) / 180);
}

// 縮尺 1:N で、紙の上の 1mm を何ピクセルにするかを決めると、1mあたりのピクセル数が決まる。
// 1m（=1000mm）は紙の上で 1000/N mm になるため。
export function pxPerMeterFromScale(scaleDenominator, pxPerMm) {
  return (1000 / scaleDenominator) * pxPerMm;
}

// DPI は「1インチ（25.4mm）あたりのピクセル数」で、1mmあたりのピクセル数を言い換えただけ
export function dpiFromPxPerMm(pxPerMm) {
  return pxPerMm * 25.4;
}

// ---- 平面座標 → 画面（第3章・第5章で共通） ----

// 画面の中心に来る平面座標 (cx, cy) と、1mあたりのピクセル数 k を決めれば、
// あとは引き算・掛け算・足し算だけ。平面座標は北が正、画面は下が正なので Y だけ符号が逆になる。
export function planeToScreen(east, north, view) {
  return {
    px: view.width / 2 + (east - view.cx) * view.k,
    py: view.height / 2 - (north - view.cy) * view.k,
  };
}

export function screenToPlane(px, py, view) {
  return {
    east: view.cx + (px - view.width / 2) / view.k,
    north: view.cy - (py - view.height / 2) / view.k,
  };
}

// ---- 第4章: XYZタイル ----

export const TILE_SIZE = 256;

export function worldSize(zoom) {
  return TILE_SIZE * 2 ** zoom;
}

export function tileOf(x, y, zoom) {
  const size = worldSize(zoom);
  const px = x * size;
  const py = y * size;
  const tileX = Math.floor(px / TILE_SIZE);
  const tileY = Math.floor(py / TILE_SIZE);
  return {
    size,
    px,
    py,
    tileX,
    tileY,
    innerX: px - tileX * TILE_SIZE,
    innerY: py - tileY * TILE_SIZE,
  };
}

// ---- 第5章: 平面直角座標系 第VI系 ----

// 原点は北緯36度・東経136度。JGD2011（EPSG:6674）の定義。
// Natural EarthはWGS84なので厳密には測地系が違うが、この縮尺では差は見えないので同一視する。
export const JPRCS_VI =
  "+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs";

// proj4 は (東向き, 北向き) の順で返す。測量の X は北向き、Y は東向きなので名前を付け替える。
export function makeJprcs(proj4) {
  const converter = proj4("EPSG:4326", JPRCS_VI);
  return {
    forward(lon, lat) {
      const [east, north] = converter.forward([lon, lat]);
      return { X: north, Y: east };
    },
    inverse(X, Y) {
      const [lon, lat] = converter.inverse([Y, X]);
      return { lon, lat };
    },
  };
}

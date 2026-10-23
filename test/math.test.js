// 参照値は PROJ の cs2cs（GDAL 3.12 同梱の PROJ）で求めたもの。
// 自前の計算が外部の実装と一致することを確かめるため、手計算の値ではなく cs2cs の出力を使う。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as m from "../src/math.js";

const require = createRequire(import.meta.url);
const proj4 = require("../vendor/proj4.js");

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} != ${expected}`);

test("第1章: 720×360 の四隅と中心", () => {
  assert.deepEqual(m.plateToPixel(-180, 90, 2), { px: 0, py: 0 });
  assert.deepEqual(m.plateToPixel(180, -90, 2), { px: 720, py: 360 });
  assert.deepEqual(m.plateToPixel(0, 0, 2), { px: 360, py: 180 });
  const back = m.pixelToPlate(631, 110.6, 2);
  near(back.lon, 135.5, 1e-9, "lon");
  near(back.lat, 34.7, 1e-9, "lat");
});

test("第2章: Webメルカトルの正方形", () => {
  near(m.MERCATOR_MAX_LAT, 85.0511287798, 1e-9, "max lat");
  const eq = m.mercatorUnit(0, 0);
  near(eq.x, 0.5, 1e-12, "赤道は中央");
  near(eq.y, 0.5, 1e-12, "赤道は中央");
  near(m.mercatorUnit(0, m.MERCATOR_MAX_LAT).y, 0, 1e-12, "北端");
  near(m.mercatorUnit(0, -m.MERCATOR_MAX_LAT).y, 1, 1e-12, "南端");
  const u = m.mercatorUnit(135.5, 34.7);
  const back = m.mercatorUnitInverse(u.x, u.y);
  near(back.lat, 34.7, 1e-9, "逆変換");
});

test("第3章: EPSG:3857 は cs2cs と一致する", () => {
  const u = m.mercatorUnit(135.5, 34.7);
  const { mx, my } = m.unitToMeters(u.x, u.y);
  near(mx, 15083791.0025, 1e-3, "mx");
  near(my, 4123186.7097, 1e-3, "my");
});

test("第3章: 縮尺 1:10,000 で 1mm を 4px にすると 100m は 40px", () => {
  near(m.pxPerMeterFromScale(10000, 4) * 100, 40, 1e-12, "100m");
  near(m.dpiFromPxPerMm(96 / 25.4), 96, 1e-12, "96dpi");
});

test("平面 → 画面 → 平面 が元に戻る", () => {
  const view = { width: 640, height: 480, cx: 1000, cy: 2000, k: 0.5 };
  assert.deepEqual(m.planeToScreen(1000, 2000, view), { px: 320, py: 240 });
  assert.deepEqual(m.planeToScreen(1100, 2100, view), { px: 370, py: 190 });
  const p = m.screenToPlane(370, 190, view);
  near(p.east, 1100, 1e-9, "east");
  near(p.north, 2100, 1e-9, "north");
});

test("第4章: 東京駅はズーム10でタイル 909/403", () => {
  const u = m.mercatorUnit(139.7671, 35.6812);
  const t = m.tileOf(u.x, u.y, 10);
  assert.equal(t.size, 262144);
  assert.equal(t.tileX, 909);
  assert.equal(t.tileY, 403);
  assert.ok(t.innerX >= 0 && t.innerX < 256);
  assert.ok(t.innerY >= 0 && t.innerY < 256);
});

test("第5章: 第VI系は cs2cs（EPSG:6674）と一致する", () => {
  const jp = m.makeJprcs(proj4);
  const o = jp.forward(136, 36);
  near(o.X, 0, 1e-6, "原点 X");
  near(o.Y, 0, 1e-6, "原点 Y");
  const p = jp.forward(135.5, 34.7);
  near(p.X, -144102.9143, 1e-3, "X は北向き");
  near(p.Y, -45805.673, 1e-3, "Y は東向き");
  const back = jp.inverse(p.X, p.Y);
  near(back.lon, 135.5, 1e-9, "lon");
  near(back.lat, 34.7, 1e-9, "lat");
});

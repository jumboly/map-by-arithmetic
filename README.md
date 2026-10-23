# 地図は算数で描ける — 教材

緯度経度がピクセル座標になるまでの計算を、値を変えながら確かめる教材です。
ブログ記事「[地図は算数で描ける](https://tsute.jumboly.jp/posts/map-by-arithmetic/)」と対になっています。

公開ページ: https://www.jumboly.jp/map-by-arithmetic/

地図ライブラリ（MapLibre や Leaflet）は使わず、座標からピクセルへの変換を `src/math.js` に自前で書いて、HTML Canvas に描いています。
平面直角座標系の投影計算だけは [proj4js](https://github.com/proj4js/proj4js) に任せています。

## 章（モード）

URL の `mode` で章を選びます。表示条件も URL に入るので、その状態へ直接リンクできます。

| mode       | 内容                                            | 主なパラメータ                         |
| ---------- | ----------------------------------------------- | -------------------------------------- |
| `plate`    | 緯度経度をそのまま描く                          | `s`（1度あたりのpx）, `flip`           |
| `mercator` | Webメルカトルの0〜1の正方形                     | `size`（正方形のpx）                   |
| `meters`   | EPSG:3857のメートル座標からピクセルへ           | `basis`, `ppm`, `scale`, `pxmm`, `cx`, `cy` |
| `tiles`    | XYZタイル                                       | `z`, `cx`, `cy`                        |
| `jprcs`    | 平面直角座標系 第VI系                           | `basis`, `ppm`, `scale`, `pxmm`, `cX`, `cY`, `overlay` |

どの章でも `lon` と `lat` で調べる地点を指定できます。

例: `?mode=meters&basis=scale&scale=10000&pxmm=4&lon=135.5023&lat=34.6937`

## 手元で動かす

ビルドは要りません。ES Modules と `fetch` を使うので、ファイルを直接開かずに HTTP サーバー経由で開きます。

```sh
npm run serve   # python3 -m http.server 8000
npm test        # 座標計算のテスト（Node.js 22 以降）
```

テストの参照値は PROJ の `cs2cs` で求めた値です。

## データ

- 海岸線: [Natural Earth](https://www.naturalearthdata.com/)（パブリックドメイン）
  - `data/ne_110m_coastline.geojson`: 1:110m Coastline（v4.1.0）
  - `data/osaka_bay_coastline.geojson`: 1:10m Coastline（v5.0.0-pre9）から大阪湾周辺（東経134.65〜135.55度、北緯34.1〜34.8度）を切り出したもの
- 作り直す手順は `scripts/build-data.sh` にあります

Natural Earth は WGS84、平面直角座標系の定義は JGD2011（EPSG:6674）ですが、この縮尺では差が見えないので同じものとして扱っています。

## 同梱しているもの

- `vendor/proj4.js`: proj4js 2.15.0（MIT License、`vendor/proj4-LICENSE.md`）

## ライセンス

[MIT License](LICENSE)。ただし `vendor/proj4.js` は proj4js のライセンス（MIT）に、`data/` は Natural Earth の条件（パブリックドメイン）に従います。

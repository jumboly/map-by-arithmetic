#!/bin/sh
# data/ の GeoJSON を Natural Earth の配布物から作り直す手順。
# 同梱済みなので普段は実行しなくてよい。出典と加工内容を再現できるように残している。
# 必要なもの: curl, unzip, GDAL（ogr2ogr）
set -eu

cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

curl -sSLf -o "$work/110m.zip" https://naciscdn.org/naturalearth/110m/physical/ne_110m_coastline.zip
curl -sSLf -o "$work/10m.zip" https://naciscdn.org/naturalearth/10m/physical/ne_10m_coastline.zip
unzip -q "$work/110m.zip" -d "$work/110m"
unzip -q "$work/10m.zip" -d "$work/10m"

# 属性は使わないので落とし、座標は表示に十分な桁数に丸めてファイルを軽くする
rm -f data/ne_110m_coastline.geojson data/osaka_bay_coastline.geojson
ogr2ogr -f GeoJSON data/ne_110m_coastline.geojson "$work/110m/ne_110m_coastline.shp" \
  -select "" -explodecollections -lco COORDINATE_PRECISION=4 -lco WRITE_NAME=NO

# 範囲は src/main.js の OSAKA_BBOX と合わせる
ogr2ogr -f GeoJSON data/osaka_bay_coastline.geojson "$work/10m/ne_10m_coastline.shp" \
  -select "" -clipsrc 134.65 34.1 135.55 34.8 -explodecollections \
  -lco COORDINATE_PRECISION=5 -lco WRITE_NAME=NO

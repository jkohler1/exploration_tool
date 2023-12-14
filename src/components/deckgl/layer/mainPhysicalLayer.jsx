
import {COORDINATE_SYSTEM } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { load } from '@loaders.gl/core';
import { clamp } from '@math.gl/core';
function MainTileLayerComponent({ metaData, generalData}) {
  if (!metaData) return null;

  const layer = new TileLayer({
    tileSize: metaData.tileSize,
    minZoom: -8,
    maxZoom: 0,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    extent: [0, 0, metaData.width, metaData.height],
    getTileData: async ({ index }) => {
      try {
        const { x, y, z } = index;
        const data = await load(`${generalData.ROOT_URL}/tiling/test.svs/level_${16+z}/data/test.svs_tile_${x}_${y}.png`);
        return data;
      } catch (error) {
        console.error('Error loading tile:', error);
      } 
    },
    renderSubLayers: props => {
      const {
        bbox: { left, bottom, right, top }
      } = props.tile;

      const baseLayerProps = {
        data: null,
        image: props.data,
        bounds: [
          clamp(left, 0, metaData.width),
          clamp(bottom, 0, metaData.height),
          clamp(right, 0, metaData.width),
          clamp(top, 0, metaData.height)
        ]
      };

      const bitmapLayer = new BitmapLayer(props, baseLayerProps);
      return [bitmapLayer];
    }
  });

  return layer;
}

export default MainTileLayerComponent;

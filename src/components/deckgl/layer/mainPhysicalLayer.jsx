
import {COORDINATE_SYSTEM } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { load } from '@loaders.gl/core';
import { clamp } from '@math.gl/core';
/**
 * MainTileLayerComponent function to create a TileLayer .
 * 
 * @param {Object} metaData - Metadata containing information about the visualization.
 * @param {Object} generalData - General data about the current environment and settings.
 * @returns {TileLayer} A Deck.gl TileLayer for rendering histological tiles.
 */
function MainTileLayerComponent({ metaData, generalData}) {
    // Return null if metaData is not available
  if (!metaData) return null;
  // Creating a new TileLayer
  const layer = new TileLayer({
    // Defining the size and range of the tiles
    tileSize: metaData.tileSize,
    minZoom: -metaData.zoom,
    maxZoom: 0,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    extent: [0, 0, metaData.width, metaData.height],
    getTileData: async ({ index }) => {
      try {
        const { x, y, z } = index;
        const data = await load(`${generalData.ROOT_URL}/tiling/${generalData.SLIDE_NAME}.svs/level_${16+z}/data/${generalData.SLIDE_NAME}.svs_tile_${x}_${y}.png`);
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


import {COORDINATE_SYSTEM } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { load } from '@loaders.gl/core';
import { clamp } from '@math.gl/core';

/**
 * Function to create a TileLayer for rendering histological tiles.
 * 
 * @param {Object} metaData - Metadata containing information about the visualization.
 * @param {Object} generalData - General data about the current environment and settings.
 * @returns {TileLayer} A Deck.gl TileLayer for rendering tiles.
 */
function MainTileLayerComponent({ metaData, generalData }) {
  if (!metaData) return null;

  // Creating a new TileLayer
  const layer = new TileLayer({
    id: 'tile-layer',
    tileSize: metaData.tileSize,
    minZoom: -metaData.zoom,
    maxZoom: 0,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    extent: [0, 0, metaData.width, metaData.height],

    // Function to get tile data
    getTileData: ({ index }) => {
      const { x, y, z } = index;
      // Generate the URL for the tile
      const tileUrl = `${generalData.ROOT_URL}/tiling/${generalData.SLIDE_NAME}.svs/level_${metaData.zoom+z}/data/${generalData.SLIDE_NAME}.svs_tile_${x}_${y}.png`;

      // Load and return the tile data
      return load(tileUrl)
        .then(data => data)
        .catch(error => {
          console.error(`Error loading tile x:${x} y:${y} z:${z}:`, error);
          return null;
        });
    },

    // Function to render sublayers
    renderSubLayers: props => {
      const { bbox: { left, bottom, right, top } } = props.tile;
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
      return new BitmapLayer(props, baseLayerProps);
    }
  });

  return layer;
}

export default MainTileLayerComponent;

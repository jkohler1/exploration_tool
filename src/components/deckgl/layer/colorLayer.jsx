import React from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import LAYERTYPE from '../../../enums/LayerType';
import * as turf from '@turf/turf';


function generateData(tileSize, touchedData,layerType) {
  if (!touchedData || touchedData.length === 0) {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
  if(layerType===LAYERTYPE.PHYSICAL){
    const features = touchedData.map(d => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [d.x, d.y],
          [d.x + tileSize, d.y],
          [d.x + tileSize, d.y + tileSize],
          [d.x, d.y + tileSize],
          [d.x, d.y]
        ]]
      }
    }));
    return {
      type: 'FeatureCollection',
      features
    };
  }else if (layerType === LAYERTYPE.LATENT) {
    const radius = 10; // Choisissez le rayon du cercle selon vos besoins
    const features = touchedData.map(d => ({
      type: 'Feature',
      properties: {},
      geometry: turf.circle(
        [d.umap_x, d.umap_y],
        radius
        )
    }));
    console.log(features)
    return {
      type: 'FeatureCollection',
      features
    };
  }
}

function GeoJsonColorTileLayer({ metaData,touchedData, layerType }) {
  const geojsonLayer = new GeoJsonLayer({
    id: 'geojson-tile-layer',
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    data: generateData(metaData.tileSize,touchedData,layerType),
    updateTriggers: {
        data: touchedData
    },
    lineWidthScale: 20,
    lineWidthMinPixels: 1,
    getLineColor: [255, 0, 0, 255], // Rouge
    getFillColor: [0, 0, 0, 0] // transparent
  });

  return geojsonLayer;
}

export default GeoJsonColorTileLayer;

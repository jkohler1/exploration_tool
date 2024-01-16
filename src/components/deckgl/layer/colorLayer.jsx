import React from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
/**
 * Function to generate data for the GeoJsonLayer.
 * 
 * @param {number} tileSize - The size of each tile.
 * @param {Array} annotations - Array of annotation objects.
 * @param {Object} settingsManager - Settings manager object.
 * @returns {Array} Array of GeoJsonLayer instances.
 */
function generateData(tileSize, annotations,settingsManager) {
    // Return an empty array if there are no annotations
  if (!annotations || annotations.length === 0) {
    return [];
  }

  const layers = [];
  annotations.forEach(annotation => {
    // Process only if the annotation is set to be displayed
    if(annotation.display){
      // Map each physical touch point to a GeoJSON Feature
      const features = annotation.physicalTouched.map(d => ({
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
    

    const geojsonLayer = new GeoJsonLayer({
      id: `geojson-tile-layer-${annotation.id}`,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      data: {
        type: 'FeatureCollection',
        features
      },
      updateTriggers: {
        data: features
      },
      lineWidthMinPixels: settingsManager.minTileWidth,
      getLineColor: annotation.color
        ? [...annotation.color.slice(0, 3), settingsManager.opacity]
        : [255, 0, 0, settingsManager.opacity],
      getFillColor: annotation.color
        ? [...annotation.color.slice(0, 3), settingsManager.opacity]
        : [255, 0, 0, settingsManager.opacity]
    });

    layers.push(geojsonLayer);
   } 
  
  // Add additional conditions for other layer types if needed
  });

  return layers;
}


function GeoJsonColorTileLayer({ metaData, dataManager,settingsManager }) {
  const layers = generateData(metaData.tileSize, dataManager.annotation,settingsManager);

  return layers;
}

export default GeoJsonColorTileLayer;

import React from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';

function generateData(tileSize, annotations,settingsManager) {
  if (!annotations || annotations.length === 0) {
    return [];
  }

  const layers = [];
  annotations.forEach(annotation => {
    if(annotation.display){
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
      lineWidthScale: settingsManager.lineTileWidth,
      lineWidthMinPixels: settingsManager.minTileWidth,
      getLineColor: annotation.color||[255, 0, 0, 255], // Rouge
      getFillColor: [0, 0, 0, 0] // transparent
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

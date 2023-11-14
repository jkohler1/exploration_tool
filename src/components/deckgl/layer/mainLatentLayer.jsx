import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import { CompositeLayer } from '@deck.gl/core';
import { BitmapLayer, ScatterplotLayer } from '@deck.gl/layers';

class MainLatentLayer extends CompositeLayer {
  renderLayers() {
    const { dataManager,settingsManager } = this.props;
    const layers = [];

    // Add scatterplotLayer if onlyAnnotation is not true
    if (!settingsManager.onlyAnnotation) {
      const scatterplotLayer = new ScatterplotLayer({
        data: dataManager.model_data,
        radiusScale: settingsManager.pointSize,
        radiusMinPixels: settingsManager.minPointSize,
        getPosition: (d) => [d.umap_x, d.umap_y],
        getColor: [255, 0, 128],
      });

      layers.push(scatterplotLayer);
    }

    const latentPointsLayers = dataManager.annotation.map(annotation => {
      if (annotation.latentTouched && annotation.latentTouched.length > 0 && annotation.display === true) {
        const layer = new ScatterplotLayer({
          id: `latentPointsLayer_${annotation.id}`, // Provide a unique id for each layer
          data: annotation.latentTouched,
          radiusScale: settingsManager.pointSize+settingsManager.increaseAnnotationPointSize,
          radiusMinPixels: settingsManager.minPointSize+settingsManager.increaseAnnotationMinPointSize,
          getPosition: (d) => [d.umap_x, d.umap_y],
          getFillColor: annotation.color || [0, 128, 255], // Use the provided color or default to [0, 128, 255]
        });
        layers.push(layer);
      }
      return null;
    });
    return layers    
  }
}
export default MainLatentLayer;


 
import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import { CompositeLayer } from '@deck.gl/core';
import { BitmapLayer, ScatterplotLayer } from '@deck.gl/layers';

class MainLatentLayer extends CompositeLayer {
  componentDidUpdate(prevProps) {
    console.log('MainLatentLayer Updated');
    // Ajoutez d'autres déclarations de journalisation ou vérifications ici
  }
  renderLayers() {
    const { dataManager } = this.props;
    const scatterplotLayer = new ScatterplotLayer({
      data: dataManager.model_data,
      radiusScale: 1000,
      radiusMinPixels: 0.5,
      getPosition: (d) => [d.umap_x, d.umap_y],
      getColor: [255, 0, 128],
    });
    const latentPointsLayers = dataManager.annotation.map(annotation => {
      if (annotation.latentTouched && annotation.latentTouched.length > 0 && annotation.display === true) {
        return new ScatterplotLayer({
          id: `latentPointsLayer_${annotation.id}`, // Provide a unique id for each layer
          data: annotation.latentTouched,
          radiusScale: 2000,
          radiusMinPixels: 4,
          getPosition: (d) => [d.umap_x, d.umap_y],
          getFillColor: annotation.color || [0, 128, 255], // Use the provided color or default to [0, 128, 255]
        });
      }
      return null;
    });
    
    // Filter out null layers
    const validLatentPointsLayers = latentPointsLayers.filter(layer => layer !== null);
    
    return [scatterplotLayer, ...validLatentPointsLayers];        
  }
}
export default MainLatentLayer;


 
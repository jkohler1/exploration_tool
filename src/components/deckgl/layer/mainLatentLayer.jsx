import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import { CompositeLayer } from '@deck.gl/core';
import { BitmapLayer, ScatterplotLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import * as turf from '@turf/turf';

class MainLatentLayer extends CompositeLayer {
  renderLayers() {
    const { layerData, latentTouchedData } = this.props;
    console.log(latentTouchedData)
    const scatterplotLayer = new ScatterplotLayer({
      data: layerData,
      radiusScale: 1000,
      radiusMinPixels: 0.5,
      getPosition: (d) => [d.umap_x, d.umap_y],
      getColor: [255, 0, 128],
    });

    const latentPointsLayer = latentTouchedData && latentTouchedData.length > 0 ? 
    new ScatterplotLayer({
      data: latentTouchedData,
      radiusScale: 1000,
      radiusMinPixels: 0.5,
      getPosition: (d) => [d.umap_x, d.umap_y], // Remplacez latent_x et latent_y par les propriétés correctes
      getColor: [0, 128, 255], // Couleur différente pour les points latents
    }) : null;

    return [scatterplotLayer, latentPointsLayer];
  }
}
export default MainLatentLayer;

import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import { CompositeLayer } from '@deck.gl/core';
import { BitmapLayer, ScatterplotLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import * as turf from '@turf/turf';

class MainLatentLayer extends CompositeLayer {

  renderLayers() {
    const { layerData} = this.props;

    
    if (!layerData) {
      return new ScatterplotLayer({});
    } else {
      return new ScatterplotLayer({
        data: layerData,
        radiusScale: 1000,
        radiusMinPixels: 0.5,
        getPosition: d => [d.umap_x, d.umap_y],
        getColor: [255, 0, 128]
      });
    }
  }
  
}

export default MainLatentLayer;

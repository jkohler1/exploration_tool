import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import { load } from '@loaders.gl/core';
import GL from '@luma.gl/constants'
import { CompositeLayer } from '@deck.gl/core';
import { BitmapLayer, ScatterplotLayer,GeoJsonLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import * as turf from '@turf/turf';
class MainLatentLayer extends CompositeLayer {

  getVisiblePoints(viewState, layerData) {
    const { latitude, longitude, zoom, width, height } = viewState;
    const bounds = new WebMercatorViewport({ width, height, latitude, longitude, zoom }).getBounds();
    const polygon = turf.polygon([[
        [bounds[0], bounds[1]],
        [bounds[2], bounds[1]],
        [bounds[2], bounds[3]],
        [bounds[0], bounds[3]],
        [bounds[0], bounds[1]]
      ]]);
    const dataInsidePolygon = [];

    layerData.forEach(d => {
      const umap_x = d.umap_x;
      const umap_y = d.umap_y;
      if (!isNaN(umap_x) && !isNaN(umap_y)) {
        const point = turf.point([umap_x, umap_y]);
        if (turf.booleanPointInPolygon(point, polygon)) {
          dataInsidePolygon.push(d);
        }
      }
    });
    return dataInsidePolygon;
  }

  loadDataZoom(data,dataManager,settingsManager,layers){
    if (data.length > 0) {
      data.forEach(dataPoint => {
        const img = `/output_data/data/tiling/test.svs/level_16/data/${dataPoint.filename}`;
        const TAILLE_COTE_CARRÉ = settingsManager.tileZoomSize;
        
        // Recherche de l'annotation correspondante
        const annotation = dataManager.annotation.find(annotation => 
          annotation.latentTouched &&
          annotation.latentTouched.some(item => item.filename === dataPoint.filename) &&
          annotation.display === true
        );
  
        // Couleur par défaut si l'annotation n'est pas trouvée
        let color = [255, 0, 0];
          
        layers.push(new BitmapLayer({
          id: dataPoint.filename,
          data: [dataPoint], // Vous devez passer une liste de données à BitmapLayer
          image: img,
          bounds: [
            dataPoint.umap_x - TAILLE_COTE_CARRÉ / 2,
            dataPoint.umap_y - TAILLE_COTE_CARRÉ / 2,
            dataPoint.umap_x + TAILLE_COTE_CARRÉ / 2,
            dataPoint.umap_y + TAILLE_COTE_CARRÉ / 2
          ],
          opacity: 1,
          visible: true,
          parameters: {
            clearColor: [0, 0, 0, 0],
            blendFunc: [GL.ONE, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA],
            blendEquation: GL.FUNC_ADD
          },
        }));

        if (annotation) {
          console.log(color)
          const geojsonLayer = new GeoJsonLayer({
            id: `geojson-annotation-layer-${annotation.id}-${dataPoint.umap_x}-${dataPoint.umap_y}`,
            pickable: true,
            stroked: true,
            filled: true,
            extruded: false,
            data: {
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[
                    [dataPoint.umap_x - TAILLE_COTE_CARRÉ/2, dataPoint.umap_y - TAILLE_COTE_CARRÉ/2],
                    [dataPoint.umap_x + TAILLE_COTE_CARRÉ/2, dataPoint.umap_y - TAILLE_COTE_CARRÉ/2],
                    [dataPoint.umap_x + TAILLE_COTE_CARRÉ/2, dataPoint.umap_y + TAILLE_COTE_CARRÉ/2],
                    [dataPoint.umap_x - TAILLE_COTE_CARRÉ/2, dataPoint.umap_y + TAILLE_COTE_CARRÉ/2],
                    [dataPoint.umap_x - TAILLE_COTE_CARRÉ/2, dataPoint.umap_y - TAILLE_COTE_CARRÉ/2]
                  ]]
                }
              }]
            },
            updateTriggers: {
              data: annotation
            },
            lineWidthMinPixels: settingsManager.minTileWidth,
            getLineColor: [...annotation.color, settingsManager.opacity],
            getFillColor: [...annotation.color, settingsManager.opacity]
          });
          console.log(geojsonLayer);
          layers.push(geojsonLayer);
        }
        
      });
    }
  }



  renderLayers() {
    const { dataManager,settingsManager,latentViewState,loadTiles,setLoadTiles } = this.props;
    const layers = [];
    if(latentViewState.zoom >= 7 && loadTiles){
      const data = this.getVisiblePoints(latentViewState, dataManager.model_data);
      this.loadDataZoom(data,dataManager,settingsManager,layers)
      return layers;
    }
    if (latentViewState.zoom >= 9 && !loadTiles) {
      const data = this.getVisiblePoints(latentViewState, dataManager.model_data);
      this.loadDataZoom(data,dataManager,settingsManager,layers)
      return layers;
    }
    else{
    // Add scatterplotLayer if onlyAnnotation is not true
    setLoadTiles(false)
    if (!settingsManager.onlyAnnotation) {
      const scatterplotLayer = new ScatterplotLayer({
        data: dataManager.model_data,
        radiusScale: settingsManager.pointSize,
        radiusMinPixels: settingsManager.minPointSize,
        getPosition: (d) => [d.umap_x, d.umap_y],
        getFillColor: (d) => d.avg_color[0]
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
    }
    return layers    
  }  
}
export default MainLatentLayer;
 
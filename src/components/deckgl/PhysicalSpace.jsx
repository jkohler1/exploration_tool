import React, { useState, useEffect } from 'react';

import DeckGL from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';

import {getAllTilesInsideAnnotation,generateEmptyAnnotation} from '../../utils';


import MainTileLayerComponent from './layer/mainPhysicalLayer';
import EditableLayerComponent from './layer/editionLayer';
import GeoJsonColorTileLayer from './layer/colorLayer';


/**
 * PhysicalSpace component for rendering and interacting with the physical space visualization.
 * 
 * @param {Object} activeTool - The currently active tool for interaction.
 * @param {Object} TOOLS - Collection of available tools.
 * @param {Object} metaData - Metadata for the visualization.
 * @param {Object} generalData - General data for the visualization.
 * @param {Object} dataManager - Manager for data including annotations.
 * @param {Function} setDataManager - Function to update dataManager state.
 * @param {Object} settingsManager - Manager for various settings of the visualization.
 */
export default function PhysicalSpace({activeTool,TOOLS,metaData,generalData,dataManager,setDataManager,settingsManager}) {
  
  //view state
  const [viewState, setViewState] = useState({
    target: [(metaData.height/2), (metaData.width/2)],
    zoom: -metaData.zoom + 3
  });

  //Required data for Edition Layer
  const [editedData, setEditedData] = useState({
    type: 'FeatureCollection',
    features: []
  });

  const [newFeature,setNewFeature] = useState(null)

  const [mainLayer, setMainLayer] = useState(null);
  const [colorLayer, setColorLayer] = useState(null);
  const [editionLayer, setEditionLayer] = useState(null);
  // Effect hook for initializing layers
  useEffect(() => {
    if (metaData && generalData) {
      const mainlayer = MainTileLayerComponent({ metaData, generalData});
      const editionLayer = EditableLayerComponent({activeTool,TOOLS,editedData, setEditedData,metaData,dataManager,setNewFeature});
      const geoJsonColorTileLayer = GeoJsonColorTileLayer({metaData,dataManager,settingsManager})
      
      // Updating state with the new layers
      setMainLayer(mainlayer);
      setColorLayer(geoJsonColorTileLayer);
      setEditionLayer(editionLayer);
    }
  }, [metaData, generalData, dataManager, TOOLS, activeTool,settingsManager]);
  // Effect hook for handling new features (annotations)
  useEffect(()=>{
      if(newFeature!==null){
        const latentElem = []
        const physicalElem = getAllTilesInsideAnnotation(metaData, newFeature,dataManager);
        for (const elem of physicalElem) {
          const { x, y } = elem;
          let real_x = x/metaData.tileSize
          let real_y = y/metaData.tileSize
          if (real_x in dataManager.mappingLatentPhysical.physicalToLatent && real_y in dataManager.mappingLatentPhysical.physicalToLatent[real_x]) {
            latentElem.push(dataManager.mappingLatentPhysical.physicalToLatent[real_x][real_y])
          }
        }
        let newAnnotation = generateEmptyAnnotation(latentElem,physicalElem)
        const currentAnnotation = dataManager.annotation
        currentAnnotation.push(newAnnotation)
        setDataManager({
          ...dataManager,
          annotation:currentAnnotation
        })

      }
  },[newFeature])



  return (
    <DeckGL
      views={[new OrthographicView({id: 'ortho'})]}
      layers={[mainLayer,colorLayer, editionLayer]}
      initialViewState={viewState}
      viewState={viewState}
      onViewStateChange={({ viewState }) => setViewState(viewState)}
      controller={true}
      />
  );
}

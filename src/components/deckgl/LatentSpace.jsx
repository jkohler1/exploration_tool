import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import MainLatentLayer from './layer/mainLatentLayer';
import EditableLayerComponent from './layer/editionLayer';
import {getAllPointsInsideAnnotation,generateEmptyAnnotation} from '../../utils';

export default function LatentSpace({activeTool,TOOLS,metaData,dataManager,setDataManager,settingsManager,latentViewState,setLatentViewState,loadTiles,setLoadTiles}) {
  

  //Required data for Edition Layer
  const [editedData, setEditedData] = useState({
    type: 'FeatureCollection',
    features: []
  });

  const [newFeature,setNewFeature] = useState(null)

  //Layer
  const [mainLayer, setMainLayer] = useState(null);
  const [editionLayer, setEditionLayer] = useState(null);

  useEffect(() => {  
    if(metaData){
      // Adjust the viewState to center based on the image dimensions
      setLatentViewState({
        target: [metaData.width / 2, metaData.height / 2, 0],
        zoom: -5
      });
    }
  }, [metaData]);

  useEffect(() => {
    const mainLayerComponent = new MainLatentLayer({dataManager,settingsManager,latentViewState,loadTiles,setLoadTiles});
    setMainLayer(mainLayerComponent);
}, [dataManager,settingsManager,latentViewState]);

useEffect(() => {
    const mainLayerComponent = new MainLatentLayer({dataManager,settingsManager,latentViewState,loadTiles,setLoadTiles});
    setMainLayer(mainLayerComponent);

}, [loadTiles]);

  useEffect(() => {
      const editionLayer = EditableLayerComponent({activeTool,TOOLS,editedData, setEditedData,metaData,dataManager,setNewFeature});    
      setEditionLayer(editionLayer);
  }, [metaData, dataManager,TOOLS, activeTool,settingsManager]);

  useEffect(()=>{
    if(newFeature!==null){
      const physicalElem = []
      const latentElem = getAllPointsInsideAnnotation(dataManager,newFeature);
      for (const elem of latentElem) {
        const { umap_x, umap_y } = elem;
        if (umap_x in dataManager.mappingLatentPhysical.latentToPhysical && umap_y in dataManager.mappingLatentPhysical.latentToPhysical[umap_x]) {
          physicalElem.push(dataManager.mappingLatentPhysical.latentToPhysical[umap_x][umap_y]);
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
      initialViewState={latentViewState}
      viewState={latentViewState}
      controller={true}
      layers={[mainLayer,editionLayer]}
      onViewStateChange={({ viewState }) => {
        setLatentViewState(viewState)
      }}
    />
  );
}

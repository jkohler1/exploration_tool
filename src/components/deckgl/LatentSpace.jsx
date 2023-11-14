import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import MainLatentLayer from './layer/mainLatentLayer';
import EditableLayerComponent from './layer/editionLayer';
import {getAllPointsInsideAnnotation,generateEmptyAnnotation} from '../../utils';

export default function LatentSpace({activeTool,TOOLS,metaData,dataManager,setDataManager}) {
  
  //view data
  const initialState = {
    longitude: 0,
    latitude: 0,
    zoom: 4,
    maxZoom: 16
  };
  const [viewState, setViewState] = useState(initialState);



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
      setViewState({
        target: [metaData.width / 2, metaData.height / 2, 0],
        zoom: -5
      });
    }
  }, [metaData]);


  useEffect(() => {
      const mainLayerComponent = new MainLatentLayer({dataManager});
      setMainLayer(mainLayerComponent);
      const editionLayer = EditableLayerComponent({activeTool,TOOLS,editedData, setEditedData,metaData,dataManager,setNewFeature});    
      setEditionLayer(editionLayer);
  }, [metaData, dataManager,TOOLS, activeTool]);

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
      initialViewState={viewState}
      viewState={viewState}
      controller={true}
      layers={[mainLayer,editionLayer]}
      onViewStateChange={({ viewState }) => setViewState(viewState)}
    />
  );
}

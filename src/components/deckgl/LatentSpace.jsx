import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
import MainLatentLayer from './layer/mainLatentLayer';
import EditableLayerComponent from './layer/editionLayer';
import GeoJsonColorTileLayer from './layer/colorLayer';
import {loadData} from '../../utils';

export default function LatentSpace({activeTool,TOOLS,latentTouchedData,setLatentTouchedData,latentTouchedCoordinate,setLatentTouchedCoordinate,layerType,metaData,generalData }) {
  const initialState = {
    longitude: 0,
    latitude: 0,
    zoom: 4,
    maxZoom: 16
  };
  const [editedData, setEditedData] = useState({
    type: 'FeatureCollection',
    features: []
  });
  const [currentZoomLevel, setCurrentZoomLevel] = useState(1);
  const [viewState, setViewState] = useState(initialState);
  const [mainLayer, setMainLayer] = useState(null);
  const [colorLayer, setColorLayer] = useState(null);
  const [editionLayer, setEditionLayer] = useState(null);

  const handleViewStateChange = ({ viewState }) => {
    setCurrentZoomLevel(viewState.zoom);
    setViewState(viewState);
  };
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
    if (generalData && currentZoomLevel && viewState && metaData) {
      loadData(generalData.MODEL_URL)
        .then(layerData => {
          const mainLayerComponent = new MainLatentLayer({layerData});
          setMainLayer(mainLayerComponent);
          const editionLayer = EditableLayerComponent({
            metaData,
            activeTool,
            TOOLS,
            editedData,
            setEditedData,
            touchedData: latentTouchedData,
            setTouchedData: setLatentTouchedData,
            layerType,
            layerData
          });
          setEditionLayer(editionLayer);
        })
        .catch(error => {
          console.error(error);
        });
    }
  }, [generalData, currentZoomLevel, viewState, metaData, activeTool, TOOLS, editedData, setEditedData, latentTouchedData, setLatentTouchedData,colorLayer,setColorLayer, layerType]);
  

  return (
    <DeckGL
      initialViewState={initialState}
      controller={true}
      layers={[mainLayer,editionLayer,colorLayer]}
      onViewStateChange={handleViewStateChange}
    />
  );
}

import React, { useState, useEffect } from 'react';

import DeckGL from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';



import MainTileLayerComponent from './layer/mainPhysicalLayer';
import EditableLayerComponent from './layer/editionLayer';
import GeoJsonColorTileLayer from './layer/colorLayer';




export default function PhysicalSpace({activeTool,TOOLS,physicalTouchedData,setPhysicalTouchedData,layerType,metaData,generalData}) {
  const [editedData, setEditedData] = useState({
    type: 'FeatureCollection',
    features: []
  });
  const [viewState, setViewState] = useState({
    target: [13000, 13000, 0],
    zoom: -4
  });
  const [mainLayer, setMainLayer] = useState(null);
  const [colorLayer, setColorLayer] = useState(null);
  const [editionLayer, setEditionLayer] = useState(null);

  useEffect(() => {
    if (metaData && generalData) {
      const mainlayer = MainTileLayerComponent({ metaData, generalData});
      const editionLayer = EditableLayerComponent({ metaData,  activeTool, TOOLS,editedData, setEditedData, touchedData:physicalTouchedData, setTouchedData:setPhysicalTouchedData,layerType});
      const geoJsonColorTileLayer = GeoJsonColorTileLayer({metaData,touchedData:physicalTouchedData,layerType})
      setMainLayer(mainlayer);
      setColorLayer(geoJsonColorTileLayer);
      setEditionLayer(editionLayer);
    }
  }, [metaData, generalData, activeTool, TOOLS,editedData,setEditedData, physicalTouchedData,setPhysicalTouchedData]);



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

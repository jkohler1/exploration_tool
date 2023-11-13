import React from 'react';
import { DrawPolygonMode, DrawPointMode, DrawPolygonByDraggingMode } from '@nebula.gl/edit-modes';
import { EditableGeoJsonLayer } from '@nebula.gl/layers';
import LAYERTYPE from '../../../enums/LayerType';
import {getAllTilesInsideAnnotation,getAllPointsInsideAnnotation} from '../../../utils';
function EditableLayerComponent({
  metaData,
  activeTool,
  TOOLS,
  setActiveTool,
  editedData,
  setEditedData,
  touchedData, 
  setTouchedData,
  layerType,
  layerData
}) {
  const onEdit = ({ updatedData }) => {
    if (updatedData.features.length > editedData.features.length) {
      if(layerType===LAYERTYPE.PHYSICAL){
        let touchedTilesTmp = getAllTilesInsideAnnotation(metaData, updatedData,touchedData);
        setTouchedData(touchedTilesTmp);
      }else if(layerType===LAYERTYPE.LATENT){
        let touchedTilesTmp = getAllPointsInsideAnnotation(layerData, updatedData);
        setTouchedData(touchedTilesTmp);
      } 
      setEditedData(updatedData);
      }
};

  if (!metaData) return null;

  return new EditableGeoJsonLayer({
    id: 'geojson-layer',
    tileSize: metaData.tileSize,
    extent: [0, 0, metaData.width, metaData.height],
    data: editedData,
    selectedFeatureIndexes: [],
    getFillColor: [0, 0, 0, 0], 
    mode: activeTool === TOOLS.LASSO ? new DrawPolygonMode() : activeTool === TOOLS.POINT ? new DrawPointMode() : new DrawPolygonByDraggingMode(),
    onEdit
  });
}

export default EditableLayerComponent;


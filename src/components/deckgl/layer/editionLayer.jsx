import React from 'react';
import { DrawPolygonMode, DrawPointMode, DrawPolygonByDraggingMode } from '@nebula.gl/edit-modes';
import { EditableGeoJsonLayer } from '@nebula.gl/layers';

function EditableLayerComponent({
  activeTool,TOOLS,editedData, setEditedData,metaData,dataManager,setNewFeature
}) {
  const onEdit = ({ updatedData }) => {
    if (updatedData.features.length > editedData.features.length) {
      setNewFeature(updatedData.features[updatedData.features.length - 1])
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
    getLineColor: [0, 0, 0, 0], // Set line color to fully transparent
    mode: activeTool === TOOLS.LASSO ? new DrawPolygonMode() : activeTool === TOOLS.POINT ? new DrawPointMode() : new DrawPolygonByDraggingMode(),
    onEdit
  });
}

export default EditableLayerComponent;


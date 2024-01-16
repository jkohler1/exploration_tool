import React, { useState } from 'react';
import { ChromePicker } from 'react-color';
import {loadPredefinedData,generateEmptyAnnotation} from '../utils';
import './displays.scss';

/**
 * AnnotationTable component for managing and displaying annotations.
 * 
 * @param {Object} dataManager - Object managing the current state of annotations.
 * @param {Function} setDataManager - Function to update dataManager state.
 * @param {Object} generalData - General data used in the component.
 * @param {Object} metaData - Meta data used in the component.
 */
const AnnotationTable = ({ dataManager, setDataManager ,generalData,metaData}) => {
    // State management for component-specific functionalities
  const [colorId, setColorId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [selectedColor, setSelectedColor] = useState({ r: 255, g: 255, b: 255, a: 1 });
  const [displayColorPicker, setDisplayColorPicker] = useState(false);

  // Function to start editing an annotation
  const startEditing = (id, name) => {
    setEditingId(id);
    setEditedName(name);
  };

  // Function to handle removal of an annotation
  const handleRemoveAnnotation = (id) => {
    const updatedAnnotations = dataManager.annotation.filter(annotation => annotation.id !== id);

    const newDataManager = { ...dataManager, annotation: updatedAnnotations };
    setDataManager(newDataManager);
  };

  // Function to cancel the editing of an annotation
  const cancelEditing = () => {
    setEditingId(null);
    setEditedName('');
  };

  // Function to save changes after editing an annotation
  const saveChanges = (id) => {
    const updatedAnnotations = dataManager.annotation.map(annotation => {
      if (annotation.id === id) {
        return { ...annotation, name: editedName};
      }
      return annotation;
    });

    const newDataManager = { ...dataManager, annotation: updatedAnnotations };
    setDataManager(newDataManager);

    setEditingId(null);
    setEditedName('');
  };

  // Function to handle color change in the color picker
  const handleChangeColor = (color) => {
    setSelectedColor(color.rgb);
  };

  // Function to handle the color picker display
  const handleClickColor = (id) => {
    setColorId(id)
    setDisplayColorPicker(!displayColorPicker);
  };

    // Function to handle the 'Enter' key press for saving changes
  const handleKeyPress = (e, id) => {
    if (e.key === 'Enter') {
      saveChanges(id);
    }
  };

  // Function to save the selected color for an annotation
  const handleSaveColor = () => {
    const updatedAnnotations = dataManager.annotation.map(annotation => {
      if (annotation.id === colorId) {
        return { ...annotation, color: [selectedColor.r, selectedColor.g, selectedColor.b] };
      }
      return annotation;
    });
  
    const newDataManager = { ...dataManager, annotation: updatedAnnotations };
    setDataManager(newDataManager);
  
    setDisplayColorPicker(false);
  };
  // Function to handle the creation of a blank annotation
  const handleBlankAnnotation = () => {
    const newDataManager = { ...dataManager, annotation: [] };
    setDataManager(newDataManager);
  };
  // Function to load default annotations
  const handleDefaultAnnotation = () => {
    loadPredefinedData(generalData.MODEL_URL,generalData.current_model, dataManager)
    .then(annotationTab => {
      setDataManager({
        ...dataManager,
        annotation:annotationTab
      })
    })
    .catch(error => {
      console.error(error);
    });
   
};
  // Function to handle the import of annotations
  const handleImportAnnotation = (e) => {
    e.preventDefault();

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".geojson"; 
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target.result;
        const importedGeoJSON = JSON.parse(content);
        const annotationDico = {};
        try {
          // Parsez le contenu du fichier en tant qu'objet GeoJSON
          const importedGeoJSON = JSON.parse(content);

          // Assurez-vous que la structure du GeoJSON est conforme à vos attentes
          if (importedGeoJSON && importedGeoJSON.features) {
            // Traversez les caractéristiques du GeoJSON
            importedGeoJSON.features.forEach(feature => {
              // Extrait les propriétés et la géométrie
              const { properties, geometry } = feature;
              const name = properties.name;
              const color = properties.color;
              const display = properties.display;
              const cluster = properties.id;
              const x = (geometry.coordinates)[0][0][0]
              const y = (geometry.coordinates)[0][0][1]
              let real_x = x/metaData.tileSize
              let real_y = y/metaData.tileSize
              if (real_x in dataManager.mappingLatentPhysical.physicalToLatent && real_y in dataManager.mappingLatentPhysical.physicalToLatent[real_x]) {
                const latent = dataManager.mappingLatentPhysical.physicalToLatent[real_x][real_y]
                if (!(cluster in annotationDico)) {    
                  const latentElem = [];
                  const physicalElem = [];
                  latentElem.push(latent)
                  physicalElem.push({x,y})
                  let newAnnotation = generateEmptyAnnotation(latentElem,physicalElem)
                  newAnnotation.name = name
                  newAnnotation.display = display
                  newAnnotation.color = color
                  annotationDico[cluster] = newAnnotation;
                } else {
                  const currentItem = annotationDico[cluster];
                  currentItem.latentTouched.push(latent);
                  currentItem.physicalTouched.push({x,y})
                }
              }

            });
          } else {
            console.error('Invalid GeoJSON format');
          }
        } catch (error) {
          console.error('Error parsing GeoJSON:', error);
        }
        const annotationList = Object.values(annotationDico);
        setDataManager({
          ...dataManager,
          annotation: annotationList
        })
      };
      reader.readAsText(file);
      }
    });
    fileInput.click();
  };
  // Function to handle the export of annotations
  const handleExportAnnotation = () => {
    // Create a GeoJSON object from annotations
    const geojson = {
      type: "FeatureCollection",
      features: dataManager.annotation.flatMap(annotation => {
        return annotation.physicalTouched.map(point => {
          return {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [[
                [point.x, point.y],
                [point.x + metaData.tileSize, point.y],
                [point.x + metaData.tileSize, point.y + metaData.tileSize],
                [point.x, point.y + metaData.tileSize],
                [point.x, point.y]
              ]],
            },
            properties: {
              name: annotation.name,
              color: annotation.color,
              display: annotation.display,
              id: annotation.id,
            },
          };
        });
      }),
    };
  
    // Convert GeoJSON to a JSON string
    const geojsonString = JSON.stringify(geojson, null, 2);
  
    // Create a Blob and initiate a download using a data URL
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(geojsonString)}`;
    const link = document.createElement("a");
    link.href = dataUri;
    link.download = "annotations.geojson";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  

  
  return (
    <div>
      <div className="annotation-buttons">
        <button onClick={handleBlankAnnotation}>Blank Annotation</button>
        <button onClick={handleDefaultAnnotation}>Default Annotation</button>
        <button onClick={(e) => handleImportAnnotation(e)}>Import Annotation</button>
        <button onClick={handleExportAnnotation}>Export Annotation</button>
      </div>
    <table className="annotation-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Nombre d'éléments</th>
          <th>Couleur</th>
          <th>Visible</th>
          <th></th> 
        </tr>
      </thead>
      <tbody>
        {dataManager.annotation.map(annotation => (
          <tr key={annotation.id}>
            <td
              onDoubleClick={() => startEditing(annotation.id, annotation.name)}
              className="editable"
            >
              {editingId === annotation.id ? (
                <>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, annotation.id)} 
                  />
                  <span
                    className="action-button save-button"
                    onClick={() => saveChanges(annotation.id)}
                  >
                    &#x2713;
                  </span>
                  <span
                    className="action-button cancel-button"
                    onClick={cancelEditing}
                  >
                    &#x2716;
                  </span>
                </>
              ) : (
                annotation.name
              )}
            </td>
            <td>{annotation.latentTouched.length} ({((annotation.latentTouched.length / dataManager.model_data.length) * 100).toFixed(2)}%)</td>
            <td>
              <div
                className="color-box"
                style={{
                  backgroundColor: `rgb(${annotation.color.join(',')})`
                }}
                onClick={() => handleClickColor(annotation.id)}
                />
              {displayColorPicker && annotation.id === colorId && (
                <div style={{ position: 'absolute', zIndex: '2' }}>
                  <ChromePicker color={selectedColor} onChange={handleChangeColor} />
                  <button onClick={handleSaveColor}>Save</button>
                </div>
              )}
            </td>
            <td>
              <input
                className="visibility-checkbox"
                type="checkbox"
                checked={annotation.display}
                onChange={() => onToggleVisibility(annotation.id, dataManager, setDataManager)}
              />
            </td>
            <td>
              <button className="action-button remove-button" onClick={() => handleRemoveAnnotation(annotation.id)}>
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

function onToggleVisibility(id, dataManager, setDataManager) {
  const updatedAnnotations = dataManager.annotation.map(annotation => {
    if (annotation.id === id) {
      return { ...annotation, display: !annotation.display };
    }
    return annotation;
  });

  const newDataManager = { ...dataManager, annotation: updatedAnnotations };
  setDataManager(newDataManager);
}

export default AnnotationTable;
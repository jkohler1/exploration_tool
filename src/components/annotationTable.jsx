import React, { useState } from 'react';
import { ChromePicker } from 'react-color';
import './displays.scss';

const AnnotationTable = ({ dataManager, setDataManager }) => {
  const [colorId, setColorId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [selectedColor, setSelectedColor] = useState({ r: 255, g: 255, b: 255, a: 1 });
  const [displayColorPicker, setDisplayColorPicker] = useState(false);

  const startEditing = (id, name) => {
    setEditingId(id);
    setEditedName(name);
  };

  const handleRemoveAnnotation = (id) => {
    const updatedAnnotations = dataManager.annotation.filter(annotation => annotation.id !== id);

    const newDataManager = { ...dataManager, annotation: updatedAnnotations };
    setDataManager(newDataManager);
  };
  const cancelEditing = () => {
    setEditingId(null);
    setEditedName('');
  };

  const saveChanges = (id) => {
    const updatedAnnotations = dataManager.annotation.map(annotation => {
      if (annotation.id === id) {
        return { ...annotation, name: editedName, color: [selectedColor.r, selectedColor.g, selectedColor.b] };
      }
      return annotation;
    });

    const newDataManager = { ...dataManager, annotation: updatedAnnotations };
    setDataManager(newDataManager);

    setEditingId(null);
    setEditedName('');
  };

  const handleChangeColor = (color) => {
    setSelectedColor(color.rgb);
  };

  const handleClickColor = (id) => {
    setColorId(id)
    setDisplayColorPicker(!displayColorPicker);
  };

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
  
  return (
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
            <td>{annotation.latentTouched.length}</td>
            <td>
              <div
                className="color-box"
                style={{
                  backgroundColor: `rgb(${annotation.color.join(',')})`
                }}
                onClick={() => handleClickColor(annotation.id)}
                />
              {displayColorPicker && (
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

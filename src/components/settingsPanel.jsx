// SettingsPanel.js
import React from 'react';

/**
 * SettingsPanel component for managing and displaying settings.
 * 
 * @param {Object} settingsManager - Object containing the current settings.
 * @param {Function} setSettingsManager - Function to update settingsManager state.
 * @param {Object} generalData - Object containing general data for the application.
 * @param {Function} setGeneralData - Function to update generalData state.
 */
const SettingsPanel = ({ settingsManager, setSettingsManager, generalData, setGeneralData }) => {
  // Function to handle changes in slider values
  const handleSliderChange = (param, value) => {
    // Update settingsManager with the new value for the given parameter
    const newSettingsManager = { ...settingsManager, [param]: value };
    setSettingsManager(newSettingsManager);
  };

  // Function to handle changes in general data (like model or reduction method)
  const onGeneralDataChange = (param, value) => {
    // Update generalData with the new value for the given parameter
    const newGeneralData = { ...generalData, [param]: value };
    setGeneralData(newGeneralData);
  };

  // Map through MODEL array to create select options
  const modelOptions = generalData.MODEL.map((modelName) => (
    <option key={modelName} value={modelName}>
      {modelName}
    </option>
  ));

  // Map through REDUC_DIM array to create select options for reduction methods
  const reducOptions = generalData.REDUC_DIM.map((reducName) => (
    <option key={reducName} value={reducName}>
      {reducName}
    </option>
  ));

  return (
    <div className="settings-panel">
      {/* Model selection dropdown */}
      <div className="slider">
        <label>Modèle:</label>
        <select
          value={settingsManager.current_model}
          onChange={(e) => onGeneralDataChange("current_model", e.target.value)}
        >
          {modelOptions}
        </select>
      </div>

      {/* Reduction method selection dropdown */}
      <div className="slider">
        <label>Reduction method:</label>
        <select
          value={settingsManager.current_reduc}
          onChange={(e) => onGeneralDataChange("current_reduc", e.target.value)}
        >
          {reducOptions}
        </select>
      </div>

      {/* Slider for adjusting tiles opacity */}
      <div className="slider">
        <label>Tiles Opacities</label>
        <input
          type="range"
          min="1"
          max="255"
          step="10"
          value={settingsManager.opacity}
          onChange={(e) => handleSliderChange('opacity', parseInt(e.target.value))}
        />
      </div>

      {/* Slider for adjusting point size */}
      <div className="slider">
        <label>Point Size</label>
        <input
          type="range"
          min="10"
          max="10000"
          step="50"
          value={settingsManager.pointSize}
          onChange={(e) => handleSliderChange('pointSize', parseInt(e.target.value))}
        />
      </div>

      {/* Slider for adjusting the point size for annotations */}
      <div className="slider">
        <label>Increase Annotation Point Size</label>
        <input
          type="range"
          min="0"
          max="10000"
          step="1"
          value={settingsManager.increaseAnnotationPointSize}
          onChange={(e) => handleSliderChange('increaseAnnotationPointSize', parseInt(e.target.value))}
        />
      </div>

      {/* Slider for adjusting the zoom size of tiles */}
      <div className="slider">
        <label>Increase Tiles Size (Zoom)</label>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={settingsManager.tileZoomSize / 0.032}
          onChange={(e) => handleSliderChange('tileZoomSize', parseInt(e.target.value) * 0.032)}
        />
      </div>

      {/* Checkbox for toggling the visibility of annotations only */}
      <div className="checkbox">
        <label>
          <input
            type="checkbox"
            checked={settingsManager.onlyAnnotation}
            onChange={(e) => handleSliderChange('onlyAnnotation', e.target.checked)}
          />
          Only Annotation
        </label>
      </div>
    </div>
  );
};

export default SettingsPanel;

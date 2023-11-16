// SettingsPanel.js
import React from 'react';

const SettingsPanel = ({ settingsManager, setSettingsManager,REDUC_DIM, MODEL, generalData, setGeneralData}) => {
  const handleSliderChange = (param, value) => {
    const newSettingsManager = { ...settingsManager, [param]: value };
    setSettingsManager(newSettingsManager);
  };
  const onGeneralDataChange = (param, value) => {
    const newGeneralData = { ...generalData, [param]: value };
    setGeneralData(newGeneralData);
  };
  const modelOptions = MODEL.map((modelName) => (
    <option key={modelName} value={modelName}>
      {modelName}
    </option>
  ));

  const reducOptions = REDUC_DIM.map((reducName) => (
    <option key={reducName} value={reducName}>
      {reducName}
    </option>
  ));


  return (
    <div className="settings-panel">
      <div className="slider">
      <label>Modèle:</label>
      <select
        value={settingsManager.current_model}
        onChange={(e) => {
          onGeneralDataChange("current_model",e.target.value);
        }}
      >
        {modelOptions}
      </select>
      </div>
      <div className="slider">
      <label>Reduction method:</label>
      <select
        value={settingsManager.current_reduc}
        onChange={(e) => {
          onGeneralDataChange("current_reduc",e.target.value);
        }}
      >
        {reducOptions}
      </select>
      </div>
      <div className="slider">
        <label>Line Tile Width</label>
        <input
          type="range"
          min="1"
          max="200"
          step="10"
          value={settingsManager.lineTileWidth}
          onChange={(e) => handleSliderChange('lineTileWidth', parseInt(e.target.value))}
        />
      </div>


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

// SettingsPanel.js
import React from 'react';

const SettingsPanel = ({ settingsManager, setSettingsManager }) => {
  const handleSliderChange = (param, value) => {
    const newSettingsManager = { ...settingsManager, [param]: value };
    setSettingsManager(newSettingsManager);
  };

  return (
    <div className="settings-panel">


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

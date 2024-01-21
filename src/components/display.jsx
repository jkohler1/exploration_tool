import React, { useEffect, useState } from "react";
import PhysicalSpace from "./deckgl/PhysicalSpace";
import LatentSpace from "./deckgl/LatentSpace";
import './displays.scss'; 
import '../style.css'
import TOOLS from '../enums/ToolsType'
import { loadData, loadPredefinedData } from '../utils';
import TableComponent from './annotationTable';
import SettingsPanel from './settingsPanel';

/**
 * Define a mapping between physical and latent spaces based on model data.
 * Fetches a CSV file and processes it to create mappings.
 * 
 * @param {string} MODEL_URL - Base URL for the model data.
 * @param {string} current_reduc - Current reduction method being used.
 * @param {string} current_model - Current model being used.
 * @param {number} tileSize - The size of the tiles used in the visualization.
 * @returns {Promise} A promise that resolves to an object containing the mappings.
 */
function defineMappingLatentPhysical(MODEL_URL, current_reduc, current_model, tileSize) {
    // Fetch and process the CSV file from the given URL
    return fetch(MODEL_URL + current_model + "/" + current_reduc + "_data.csv")
        .then(response => response.text())
        .then(data => {
            const physicalToLatent = {};
            const latentToPhysical = {};
            const regex = /(\d+)_(\d+)\.png$/; // Regex to extract the last 2 numbers of the file name

            // Split the data into lines and process each line
            const lines = data.split('\n');
            lines.forEach(line => {
                const [filename, umap_x, umap_y] = line.split(',');
                const match = filename.match(regex);
                if (match) {
                    const [, x, y] = match;
                    // Map physical coordinates to latent space
                    physicalToLatent[x] = physicalToLatent[x] || {};
                    physicalToLatent[x][y] = {
                        filename,
                        umap_x: parseFloat(umap_x),
                        umap_y: parseFloat(umap_y),
                    };
                    // Map latent coordinates to physical space
                    latentToPhysical[umap_x] = latentToPhysical[umap_x] || {};
                    latentToPhysical[umap_x][umap_y] = { x: parseInt(x * tileSize), y: parseInt(y * tileSize) };
                }
            });

            return { physicalToLatent, latentToPhysical };
        })
        .catch(error => console.error('Error fetching the file:', error));
}

/**
 * Main display component for visualizing data in physical and latent spaces.
 * Manages state for active tools, metadata, general data, and renders subcomponents for visualization.
 */
const Display = () => {
    // State variables to manage various aspects of the component
    const [activeTool, setActiveTool] = useState(TOOLS.LASSO);
    const [metaData, setMetaData] = useState(null);
    const [generalData, setGeneralData] = useState(null);
    const [loadTiles, setLoadTiles] = useState(false);
    const [latentViewState, setLatentViewState] = useState(null);
    const [initDataFetched, setInitDataFetched] = useState(false);
    const [heightPhysical, setPhysicalHeight] = useState(500); // Initial height of the physical space

    // Managing data related to the model, annotations, and settings
    const [dataManager, setDataManager] = useState({
        model_name: "No name",
        model_data: [],
        mappingLatentPhysical: [],
        annotation: []
    });
    const [settingsManager, setSettingsManager] = useState({
        // Tile parameters
        minTileWidth: 1,
        opacity: 100,
        // Scatter plot parameters
        minPointSize: 0.5,
        pointSize: 5000,
        increaseAnnotationMinPointSize: 0,
        increaseAnnotationPointSize: 0,
        onlyAnnotation: false,
        tileZoomSize: 0.032
    });

    // Fetch initial configuration and setup the environment for data visualization
    useEffect(() => {
        // Define URLs for fetching configuration and model data
        const CONFIG_URL = process.env.PUBLIC_URL + 'output_data/config.json';
        const ROOT_URL = process.env.PUBLIC_URL + 'output_data';
        const MODEL_URL = process.env.PUBLIC_URL + 'output_data/model/';
        let current_reduc = "";
        let current_model = "";
            // Initialize the latent view state
    setLatentViewState({
      longitude: 0,
      latitude: 0,
      zoom: 4,
      maxZoom: 20
  });

  // Fetch metadata and setup the initial state
  getMetaData(CONFIG_URL)
      .then(([tileSize, DZI_URL, SLIDE_NAME, MODEL, REDUC_DIM]) => {
          current_reduc = REDUC_DIM[0];
          current_model = MODEL[0];

          // Set general data state
          setGeneralData({ ROOT_URL, MODEL_URL, CONFIG_URL, current_reduc, current_model, DZI_URL, SLIDE_NAME, MODEL, REDUC_DIM });
          return defineMappingLatentPhysical(MODEL_URL, current_reduc, current_model, tileSize)
              .then(mapping => {
                  setInitDataFetched(true);
                  return { metaData, mapping };
              });
      })
      .then(({ metaData, mapping }) => {
          // Load data for the model
          loadData(MODEL_URL, current_reduc, current_model)
              .then(layerData => {
                  // Update data manager with new data
                  const tmpDataManager = {
                      ...dataManager,
                      mappingLatentPhysical: mapping,
                      model_data: layerData,
                  };
                  setDataManager(tmpDataManager);
                  return tmpDataManager;
              })
      })
      .catch(error => console.error('Error fetching the file:', error));

  // Cleanup function to reset initDataFetched state
  return () => setInitDataFetched(false);
}, []);

// Effect hook to handle changes in general data
useEffect(() => {
  // Check if initial data has been fetched
  if (!initDataFetched) {
      return;
  }

  // Function to fetch and update data based on general data changes
  const fetchData = async () => {
      try {
          const mapping = await defineMappingLatentPhysical(generalData.MODEL_URL, generalData.current_reduc, generalData.current_model, metaData.tileSize);
          const layerData = await loadData(generalData.MODEL_URL, generalData.current_reduc, generalData.current_model);
          const newAnnotation = dataManager.annotation;
          // Update annotations with new latent positions
          for (const currentAnnotation of newAnnotation) {
              const newLatentAnnotation = [];
              for (const elem of currentAnnotation.physicalTouched) {
                  const { x, y } = elem;
                  let real_x = x / metaData.tileSize;
                  let real_y = y / metaData.tileSize;
                  if (real_x in mapping.physicalToLatent && real_y in mapping.physicalToLatent[real_x]) {
                      newLatentAnnotation.push(mapping.physicalToLatent[real_x][real_y]);
                  }
              }
              currentAnnotation.latentTouched = newLatentAnnotation;
          }

          // Update data manager with new mapping and data
          const tmpDataManager = {
              ...dataManager,
              mappingLatentPhysical: mapping,
              model_data: layerData,
              annotation: newAnnotation
          };

          setDataManager(tmpDataManager);
      } catch (error) {
          console.error('Error fetching the file:', error);
      }
  };

  // Call fetchData function
  fetchData();
}, [generalData, initDataFetched]);

// Function to fetch metadata from the configuration URL
const getMetaData = async (CONFIG_URL) => {
  try {
      const res = await fetch(CONFIG_URL); // Fetch configuration data
      const data = await res.json(); // Parse JSON response
      const filePath = data.slide[0];
      const parts = filePath.split('/');
      const fileNameWithExtension = parts[parts.length - 1];
      const fileNameWithoutExtension = fileNameWithExtension.slice(0, -4);
      const model_name = data.model_name;
      const reduc_method = data.dimensionality_reduction;
      const DZI_URL = process.env.PUBLIC_URL + `output_data/tiling/${fileNameWithExtension}/info.dzi`;
      const response = await fetch(DZI_URL);
      const xmlText = await response.text();
      const dziXML = new DOMParser().parseFromString(xmlText, 'text/xml');

      // Check if overlap parameter in DZI file is non-zero
      if (Number(dziXML.getElementsByTagName('Image')[0].attributes.Overlap.value) !== 0) {
          console.warn('Overlap parameter is nonzero and should be 0');
      }

      // Extract image dimensions and tile size from DZI file
      const height = Number(dziXML.getElementsByTagName('Size')[0].attributes.Height.value);
      const width = Number(dziXML.getElementsByTagName('Size')[0].attributes.Width.value);
      const tileSize = Number(dziXML.getElementsByTagName('Image')[0].attributes.TileSize.value);
      const zoom = Number(dziXML.getElementsByTagName('Image')[0].attributes.NbLvl.value);
      // Update metadata state with the extracted values
      setMetaData({ height, width, tileSize,zoom });
              // Return relevant data for further processing
              return [tileSize, DZI_URL, fileNameWithoutExtension, model_name, reduc_method];
            } catch (error) {
                console.error('An error occurred:', error);
            }
        };
        
        // Function to remove the last annotation from the dataManager
        const removeLastAnnotation = () => {
            const idLast = dataManager.annotation[dataManager.annotation.length - 1].id;
            // Filter out the last annotation by its id
            const updatedAnnotations = dataManager.annotation.filter(annotation => annotation.id !== idLast);
        
            // Update the dataManager with the filtered annotations
            const newDataManager = { ...dataManager, annotation: updatedAnnotations };
            setDataManager(newDataManager);
        };
        
// Render the component when model data and latent view state are available
if (dataManager.model_data !== undefined && dataManager.model_data.length !== 0 && latentViewState !== undefined) {
    return (
        <div className="container">
            <h1>{generalData.SLIDE_NAME !== undefined ? generalData.SLIDE_NAME : "noName"}</h1>
            <div className="annotation-buttons toolbar">
                {/* Render buttons for each tool in TOOLS */}
                {Object.values(TOOLS).map(tool => (
                    <button
                        key={tool}
                        onClick={() => setActiveTool(tool)}
                        className={activeTool === tool ? "active" : ""}
                    >
                        {tool}
                    </button>
                ))}
                {/* Render button to remove the last annotation if any annotations exist */}
                {dataManager.annotation.length > 0 && (
                    <button
                        onClick={() => removeLastAnnotation()}
                        style={{
                            marginLeft: 'auto',
                            padding: '8px 16px',
                            border: 'none',
                            cursor: 'pointer',
                        }}>
                        {'Remove last annotation'}
                    </button>
                )}
                {/* Render button to toggle tile loading based on zoom level */}
                {latentViewState.zoom >= 7 && (
                    <button
                        onClick={() => setLoadTiles(!loadTiles)}
                        className={loadTiles ? 'active' : 'inactive'}
                        style={{
                            marginLeft: 'auto',
                            padding: '8px 16px',
                            border: 'none',
                            cursor: 'pointer',
                        }}>
                        {loadTiles ? 'Stop Load Tiles' : 'Load Tiles'}
                    </button>
                )}
            </div>

            <div className="layers-wrapper">
                {/* PhysicalSpace component for displaying physical space visualization */}
                <div className="layer" style={{ height: `${heightPhysical}px` }}>
                    <PhysicalSpace
                        activeTool={activeTool}
                        TOOLS={TOOLS}
                        metaData={metaData}
                        generalData={generalData}
                        dataManager={dataManager}
                        setDataManager={setDataManager}
                        settingsManager={settingsManager}
                    />
                </div>
                {/* LatentSpace component for displaying latent space visualization */}
                <div className="layer">
                    <LatentSpace
                        activeTool={activeTool}
                        TOOLS={TOOLS}
                        metaData={metaData}
                        dataManager={dataManager}
                        setDataManager={setDataManager}
                        settingsManager={settingsManager}
                        latentViewState={latentViewState}
                        setLatentViewState={setLatentViewState}
                        loadTiles={loadTiles}
                        setLoadTiles={setLoadTiles}
                        generalData={generalData}
                    />
                </div>
            </div>
            {/* Settings panel for user interactions and configuration */}
            <div className="parameter">
                <SettingsPanel
                    settingsManager={settingsManager}
                    setSettingsManager={setSettingsManager}
                    generalData={generalData}
                    setGeneralData={setGeneralData}
                />
            </div>
            {/* Table component to display annotations and other data */}
            <TableComponent dataManager={dataManager} setDataManager={setDataManager} generalData={generalData} metaData={metaData} />
        </div>
    );
}
}
export default Display;



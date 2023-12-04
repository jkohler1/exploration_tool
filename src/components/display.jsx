import React, { useEffect, useState } from "react";
import PhysicalSpace from "./deckgl/PhysicalSpace";
import LatentSpace from "./deckgl/LatentSpace";
import './displays.scss'; 
import '../style.css'
import TOOLS from '../enums/ToolsType'
import {loadData,loadPredefinedData} from '../utils';
import TableComponent from './annotationTable';
import SettingsPanel from './settingsPanel';

function defineMappingLatentPhysical(MODEL_URL,current_reduc,current_model,tileSize) {
    return fetch(MODEL_URL+current_model+"/"+current_reduc+"_data.csv")
      .then(response => response.text())
      .then(data => {
        const physicalToLatent = {};
        const latentToPhysical = {};
        const regex = /(\d+)_(\d+)\.png$/; // Regex pour extraire les deux derniers nombres du nom de fichier
  
        const lines = data.split('\n'); // Supposons que les données sont séparées par des sauts de ligne
  
        lines.forEach(line => {
          const [filename, umap_x, umap_y] = line.split(',');
          const match = filename.match(regex);
          if (match) {
            const [, x, y] = match;
            physicalToLatent[x] = physicalToLatent[x] || {};
            physicalToLatent[x][y] = {
              filename,
              umap_x: parseFloat(umap_x),
              umap_y: parseFloat(umap_y),
            };  
            latentToPhysical[umap_x] = latentToPhysical[umap_x] || {};
            latentToPhysical[umap_x][umap_y] = { x: parseInt(x*tileSize), y: parseInt(y*tileSize) }; //change with tile size 
          }
        });
  
        return { physicalToLatent, latentToPhysical };
      })
      .catch(error => console.error('Erreur lors de la récupération du fichier :', error));
  }
  

const Display = () => {
    
    const [activeTool, setActiveTool] = useState(TOOLS.LASSO);
    const [metaData, setMetaData] = useState(null);
    const [generalData,setGeneralData] = useState(null)
    const [loadTiles, setLoadTiles] = useState(false);
    const [latentViewState, setLatentViewState] = useState(null);
    const [annotationTab,setAnnotationTab] = useState(null)
    // Use a state variable to track whether the first useEffect has run
    const [initDataFetched, setInitDataFetched] = useState(false);

    const[dataManager,setDataManager] = useState({
      model_name : "No name",
      model_data : [],
      mappingLatentPhysical : [],
      annotation : []
    })

    const[settingsManager,setSettingsManager] = useState({
      //tile parameter
      minTileWidth : 1,   
      opacity : 100, 
      //scatter plot parameter
      minPointSize : 0.5,
      pointSize: 5000,
      increaseAnnotationMinPointSize: 0,
      increaseAnnotationPointSize: 0,
      onlyAnnotation:false,
      tileZoomSize:0.032
    })

    const REDUC_DIM = ["umap","tsne"]
    const MODEL = ["vitb8","vits14"]


    useEffect(() => {
      const ROOT_URL = process.env.PUBLIC_URL + '/output_data/data';
      const DZI_URL = process.env.PUBLIC_URL + '/output_data/data/tiling/test.svs/info.dzi';
      const MODEL_URL = process.env.PUBLIC_URL + '/output_data/data/model/';
      const current_reduc = REDUC_DIM[0]
      const current_model = MODEL[0]
      setGeneralData({ ROOT_URL, MODEL_URL, DZI_URL,current_reduc,current_model });    
      setLatentViewState({
        longitude: 0,
        latitude: 0,
        zoom: 4,
        maxZoom: 20
      })
      getMetaData(DZI_URL)
        .then(tileSize => {
          return defineMappingLatentPhysical(MODEL_URL,current_reduc,current_model, tileSize)
            .then(mapping => {
              setInitDataFetched(true);
              return { metaData, mapping };
            });
        })
        .then(({ metaData, mapping }) => {
          loadData(MODEL_URL, current_reduc, current_model)
            .then(layerData => {
              const tmpDataManager = {
                ...dataManager,
                mappingLatentPhysical: mapping,
                model_data: layerData,
              };
              setDataManager(tmpDataManager);
              return tmpDataManager; // Return the updated dataManager
            })
            .then(updatedDataManager => {
              console.log(updatedDataManager); // Log the updated dataManager
              loadPredefinedData(MODEL_URL, updatedDataManager)
                .then(annotationTab => {
                  setAnnotationTab(annotationTab)
                })
                .catch(error => {
                  console.error(error);
                });
            })
            .catch(error => {
              console.error(error);
            });
        })
        .catch(error => console.error('Erreur lors de la récupération du fichier :', error));
        return () => setInitDataFetched(false);
    }, []); 

    // On General Data Change
    useEffect(() => {
      // Check if the initial data fetch has happened
      if (!initDataFetched) {
        return;
      }
      const fetchData = async () => {
        try {
          const mapping = await defineMappingLatentPhysical(generalData.MODEL_URL, generalData.current_reduc, generalData.current_model, metaData.tileSize);
          const layerData = await loadData(generalData.MODEL_URL, generalData.current_reduc, generalData.current_model);
          const newAnnotation = dataManager.annotation
          for(const currentAnnotation of newAnnotation){
            const newLatentAnnotation = []
            for (const elem of currentAnnotation.physicalTouched) {
              const { x, y } = elem;
              let real_x = x/metaData.tileSize
              let real_y = y/metaData.tileSize
              if (real_x in mapping.physicalToLatent && real_y in mapping.physicalToLatent[real_x]) {
                newLatentAnnotation.push(mapping.physicalToLatent[real_x][real_y])
              }
            }
            currentAnnotation.latentTouched = newLatentAnnotation
          }
          

          const tmpDataManager = {
            ...dataManager,
            mappingLatentPhysical: mapping,
            model_data: layerData,
            annotation : newAnnotation
          };

          setDataManager(tmpDataManager);
        } catch (error) {
          console.error('Erreur lors de la récupération du fichier :', error);
        }
      };

      fetchData();
    }, [generalData,initDataFetched]);

    const getMetaData = async (DZI_URL) => {
      const response = await fetch(DZI_URL);
      const xmlText = await response.text();
      const dziXML = new DOMParser().parseFromString(xmlText, 'text/xml');


      if (Number(dziXML.getElementsByTagName('Image')[0].attributes.Overlap.value) !== 0) {
        console.warn('Overlap parameter is nonzero and should be 0');
      }

      const height = Number(dziXML.getElementsByTagName('Size')[0].attributes.Height.value);
      const width = Number(dziXML.getElementsByTagName('Size')[0].attributes.Width.value);
      const tileSize = Number(dziXML.getElementsByTagName('Image')[0].attributes.TileSize.value);
      setMetaData({ height, width, tileSize });
      return tileSize
    }

    if(dataManager.model_data !== undefined && dataManager.model_data.length !== 0 && latentViewState!== undefined){
      return (
        <div className="container">
            <h1>Slide name</h1>            
            <div className="toolbar">
                {Object.values(TOOLS).map(tool => (
                    <button 
                        key={tool}
                        onClick={() => setActiveTool(tool)}
                        className={activeTool === tool ? "active" : ""}
                    >
                        {tool}
                    </button>
                ))}
                 {latentViewState.zoom >= 7 && (
                  <button
                    onClick={() => 
                      setLoadTiles(!loadTiles)
                      
                    }
                    className={loadTiles ? 'active' : 'inactive'}
                    style={{
                      marginLeft: 'auto',
                      padding: '8px 16px',  // Ajustez la taille du bouton en modifiant ces valeurs
                      backgroundColor: loadTiles ? '#4CAF50' : '#555',  // Couleur de fond
                      color: 'white',  // Couleur du texte
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}                  >
                    {loadTiles ? 'Stop Load Tiles' : 'Load Tiles'}
                  </button>
                )}
            </div>
            
            <div className="layers-wrapper">
                <div className="layer">
                <PhysicalSpace 
                    activeTool={activeTool}
                    TOOLS = {TOOLS} 
                    metaData={metaData}
                    generalData={generalData}
                    dataManager={dataManager}
                    setDataManager={setDataManager}
                    settingsManager={settingsManager}
                />
                </div>
                <div className="layer">
                    <LatentSpace
                     activeTool={activeTool}
                     TOOLS = {TOOLS} 
                     metaData={metaData}
                     dataManager={dataManager}
                     setDataManager={setDataManager}
                     settingsManager={settingsManager}
                     latentViewState={latentViewState}
                     setLatentViewState={setLatentViewState}
                     loadTiles={loadTiles}
                     setLoadTiles={setLoadTiles}
                    />
                </div>
            </div>
            <div className="parameter">
            <SettingsPanel
              settingsManager={settingsManager}
              setSettingsManager={setSettingsManager}
              REDUC_DIM={REDUC_DIM}
              MODEL={MODEL}
              generalData={generalData}
              setGeneralData={setGeneralData}
            />
            </div>
            <TableComponent dataManager={dataManager} setDataManager={setDataManager} generalData={generalData} annotationTab={annotationTab} metaData={metaData}/>
    </div>
    );
    }
    
}

export default Display;

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
    // Use a state variable to track whether the first useEffect has run
    const [initDataFetched, setInitDataFetched] = useState(false);
    const [heightPhysical, setPhysicalHeight] = useState(500); // Hauteur initiale


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




    useEffect(() => {
      const CONFIG_URL = process.env.PUBLIC_URL+'output_data/config.json' 
      const ROOT_URL = process.env.PUBLIC_URL + 'output_data';
      const MODEL_URL = process.env.PUBLIC_URL + 'output_data/model/';
      let current_reduc = ""
      let current_model = ""
      setLatentViewState({
        longitude: 0,
        latitude: 0,
        zoom: 4,
        maxZoom: 20
      })
      getMetaData(CONFIG_URL)
      .then(([tileSize, DZI_URL, SLIDE_NAME, MODEL,REDUC_DIM]) => {
        current_reduc = REDUC_DIM[0]
        current_model = MODEL[0]
        setGeneralData({ ROOT_URL, MODEL_URL,CONFIG_URL,current_reduc,current_model,DZI_URL,SLIDE_NAME,MODEL,REDUC_DIM }); 
        return defineMappingLatentPhysical(MODEL_URL, current_reduc, current_model, tileSize)
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

    const getMetaData = async (CONFIG_URL) => {
      try {
        // Récupérez le chemin d'accès depuis CONFIG_URL
        const res = await fetch(CONFIG_URL);
        const data = await res.json();
        
        // Utilisez l'approche précédente pour extraire le nom du fichier sans l'extension
        const filePath = data.slide[0];
        const parts = filePath.split('/');
        const fileNameWithExtension = parts[parts.length - 1];
        const fileNameWithoutExtension = fileNameWithExtension.slice(0, -4);
        const model_name = data.model_name
        const reduc_method = data.dimensionality_reduction
        const DZI_URL = process.env.PUBLIC_URL + `output_data/tiling/${fileNameWithExtension}/info.dzi`;
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
        
        
        return [tileSize,DZI_URL,fileNameWithoutExtension,model_name,reduc_method];
      } catch (error) {
        console.error('Une erreur s\'est produite :', error);
        // Gérez l'erreur comme nécessaire
      }
    };
    

    const removeLastAnnotation = () => {
      const idLast = (dataManager.annotation)[dataManager.annotation.length-1].id
      const updatedAnnotations = dataManager.annotation.filter(annotation => annotation.id !== idLast);
  
      const newDataManager = { ...dataManager, annotation: updatedAnnotations };
      setDataManager(newDataManager);
    };


    if(dataManager.model_data !== undefined && dataManager.model_data.length !== 0 && latentViewState!== undefined){
      return (
        <div className="container">
            <h1>{generalData.SLIDE_NAME !== undefined ? generalData.SLIDE_NAME : "noName"}</h1>            
            <div className="annotation-buttons toolbar">
                {Object.values(TOOLS).map(tool => (
                    <button 
                        key={tool}
                        onClick={() => setActiveTool(tool)}
                        className={activeTool === tool ? "active" : ""}
                    >
                        {tool}
                    </button>
                ))}
                {dataManager.annotation.length > 0  && (
                  <button
                    onClick={() => 
                      removeLastAnnotation()
                    }
                    style={{
                      marginLeft: 'auto',
                      padding: '8px 16px',  // Ajustez la taille du bouton en modifiant ces valeurs
                      border: 'none',
                      cursor: 'pointer',
                    }}                  >
                    {'Remove last annotation'}
                  </button>
                )}
                 {latentViewState.zoom >= 7 && (
                  <button
                    onClick={() => 
                      setLoadTiles(!loadTiles)                      
                    }
                    className={loadTiles ? 'active' : 'inactive'}
                    style={{
                      marginLeft: 'auto',
                      padding: '8px 16px',  // Ajustez la taille du bouton en modifiant ces valeurs
                      border: 'none',
                      cursor: 'pointer',
                    }}                  >
                    {loadTiles ? 'Stop Load Tiles' : 'Load Tiles'}
                  </button>
                )}
            </div>
            
            <div className="layers-wrapper">
                <div className="layer" style={{ height: `${heightPhysical}px`}}>
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
                     generalData={generalData}
                     />
                </div>
            </div>
            <div className="parameter">
            <SettingsPanel
              settingsManager={settingsManager}
              setSettingsManager={setSettingsManager}
              generalData={generalData}
              setGeneralData={setGeneralData}
            />
            </div>
            <TableComponent dataManager={dataManager} setDataManager={setDataManager} generalData={generalData} metaData={metaData}/>
    </div>
    );
    }
    
}

export default Display;

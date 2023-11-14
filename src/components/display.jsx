import React, { useEffect, useState } from "react";
import PhysicalSpace from "./deckgl/PhysicalSpace";
import LatentSpace from "./deckgl/LatentSpace";
import './displays.scss'; 
import TOOLS from '../enums/ToolsType'
import {loadData} from '../utils';
import TableComponent from './annotationTable';
import SettingsPanel from './settingsPanel';

function defineMappingLatentPhysical(filename,tileSize) {
    return fetch(filename)
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
    //URL
    const ROOT_URL = process.env.PUBLIC_URL + '/output_data/transfer2';
    const MODEL_URL = process.env.PUBLIC_URL + '/output_data/transfer2/model/umap_data.csv'
    const DZI_URL = process.env.PUBLIC_URL + '/output_data/transfer2/tiling/test.svs/info.dzi'


    const [activeTool, setActiveTool] = useState(TOOLS.LASSO);
    const [metaData, setMetaData] = useState(null);
    const [generalData,setGeneralData] = useState({ROOT_URL,MODEL_URL,DZI_URL})

    const[dataManager,setDataManager] = useState({
      model_name : "No name",
      model_data : [],
      mappingLatentPhysical : [],
      annotation : []
    })

    const[settingsManager,setSettingsManager] = useState({
      //tile parameter
      minTileWidth : 1,   
      lineTileWidth : 20, 
      //scatter plot parameter
      minPointSize : 0.5,
      pointSize: 1000,
      increaseAnnotationMinPointSize: 0,
      increaseAnnotationPointSize: 0,
      onlyAnnotation:false
    })


    const loadMappingLatentPhysical = (tileSize) => {
      defineMappingLatentPhysical(`${MODEL_URL}`,tileSize)
        .then(mapping => {
          const tmpDataManager = dataManager
          tmpDataManager.mappingLatentPhysical = mapping
          setDataManager(tmpDataManager)
        })
        .catch(error => console.error('Erreur lors de la récupération du fichier :', error));
    };

    useEffect(() => {
      const fetchData = async () => {
        await getMetaData(DZI_URL);
      };
      loadData(MODEL_URL)
      .then(layerData=>{
        const tmpDataManager = dataManager
        tmpDataManager.model_data = layerData
        setDataManager(tmpDataManager)
      }).catch(error => {
        console.error(error);
      });
      fetchData();
    }, [ROOT_URL,MODEL_URL,DZI_URL]); 

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
      loadMappingLatentPhysical(tileSize)
    }

    if(dataManager.model_data !== undefined && dataManager.model_data.length !== 0){
      return (
        <div className="container">
            <h1>Example display</h1>
            
            <div className="toolbar">
                {Object.values(TOOLS).map(tool => (
                    <button 
                        key={tool}
                        onClick={() => setActiveTool(tool)}
                        className={activeTool === tool ? "active" : ""}
                    >
                        {tool} {/* to replace with icon*/} 
                    </button>
                ))}
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
                    />
                </div>
            </div>
            <SettingsPanel settingsManager={settingsManager} setSettingsManager={setSettingsManager} />
            <TableComponent dataManager={dataManager} setDataManager={setDataManager}/>
    </div>
    );
    }
    
}

export default Display;

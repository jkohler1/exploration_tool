import * as turf from '@turf/turf';

export function getAllTilesInsideAnnotation(metaData, newFeature,dataManager) {
    const tileSize = metaData.tileSize;
    const imageWidth = metaData.width;
    const imageHeight = metaData.height;
    const maxZoomLevel = 16;
  
    let touchedData = [];
    const zoom = maxZoomLevel;
  
    const tilesInX = Math.ceil(imageWidth / (tileSize * Math.pow(2, maxZoomLevel - zoom)));
    const tilesInY = Math.ceil(imageHeight / (tileSize * Math.pow(2, maxZoomLevel - zoom)));
    for (let x = 0; x < tilesInX; x++) {
      for (let y = 0; y < tilesInY; y++) {
        const centerX = (x + 0.5) * tileSize * Math.pow(2, maxZoomLevel - zoom);
        const centerY = (y + 0.5) * tileSize * Math.pow(2, maxZoomLevel - zoom);
  
        const point = turf.point([centerX, centerY]);
  
        if (turf.booleanPointInPolygon(point, newFeature) && x in dataManager.mappingLatentPhysical.physicalToLatent && y in dataManager.mappingLatentPhysical.physicalToLatent[x]) {
          // Créez une clé unique pour la tuile touchée
          touchedData.push({ x: x * tileSize, y: y * tileSize });
        }
      }
    }
    return touchedData;
  }

  export function getAllPointsInsideAnnotation(dataManager, newFeature) {
    const layerData = dataManager.model_data
    let touchedData = []
    for (const point of layerData) {
      const { umap_x, umap_y } = point;
      if (!isNaN(umap_x)) {
        const turfPoint = turf.point([umap_x, umap_y]);
        if (turf.booleanPointInPolygon(turfPoint, newFeature)) {
          touchedData.push(point);
        }
      }
    }
    return touchedData;
  }
  
  export function loadData(MODEL_URL,current_reduc,current_model) {
    return fetch(MODEL_URL+current_model+"/"+current_reduc+"_data.csv")
      .then(response => response.text())
      .then(data => {
        const lines = data.split('\n');
        const layerData = lines.slice(1).map(line => {
          const [filename, umap_x, umap_y,avg_color] = line.split(',');
          let jsArray = [0, 128, 255]
          if(avg_color !== undefined){
            let correctedStringArray = avg_color.replace(/\s+/g, ',');
            jsArray = JSON.parse(`[${correctedStringArray}]`);
          }
          
          return {
            filename,
            umap_x: parseFloat(umap_x),
            umap_y: parseFloat(umap_y),
            avg_color:jsArray
          };
        });
        return layerData;
      })
      .catch(error => {
        console.error(error);
        return null; 
      });
  }
  
  export function loadPredefinedData(MODEL_URL, dataManager) {
    return fetch(`${MODEL_URL}/modelpoints_clusters.csv`)
      .then((response) => response.text())
      .then((data) => {
        const lines = data.split('\n');
        const layerData = lines.slice(1).map((line) => {
          const [umap_x, umap_y, cluster, filename, avg_color] = line.split(',');
          if (cluster !== '-1' && cluster !== undefined) {
            let jsArray = [0, 128, 255];
  
            if (avg_color !== undefined) {
              let correctedStringArray = avg_color.replace(/\s+/g, ',');
              jsArray = JSON.parse(`[${correctedStringArray}]`);
            }
  
            return {
              filename,
              umap_x: parseFloat(umap_x),
              umap_y: parseFloat(umap_y),
              cluster: cluster,
              avg_color: jsArray,
            };
          }
          return null;
        });
  
        const annotationDico = {};
        for (const elem of layerData) {
          if (elem !== null) {
            const { umap_x, umap_y, filename, cluster } = elem;
            if (cluster!==undefined && !(cluster in annotationDico)) {
              const latentElem = [];
              const physicalElem = [];
              if (
                umap_x in dataManager.mappingLatentPhysical.latentToPhysical &&
                umap_y in dataManager.mappingLatentPhysical.latentToPhysical[umap_x]
              ) {
                physicalElem.push(
                  dataManager.mappingLatentPhysical.latentToPhysical[umap_x][umap_y]
                );
              }
  
              latentElem.push({ umap_x, umap_y, filename });
  
              annotationDico[cluster] = { latentElem, physicalElem };
            } else {
              const currentItem = annotationDico[cluster];
              if (
                umap_x in dataManager.mappingLatentPhysical.latentToPhysical &&
                umap_y in dataManager.mappingLatentPhysical.latentToPhysical[umap_x]
              ) {
                currentItem.physicalElem.push(
                  dataManager.mappingLatentPhysical.latentToPhysical[umap_x][umap_y]
                );
              }
  
              currentItem.latentElem.push({ umap_x, umap_y, filename });
            }
          }
        }
  
        const annotationTab = Object.values(annotationDico).map((annotation) =>
          generateEmptyAnnotation(annotation.latentElem, annotation.physicalElem)
        );
  
        return annotationTab;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
  }
  

  function generateRandomColor() {
    const randomColor = [
      Math.floor(Math.random() * 256), // Rouge
      Math.floor(Math.random() * 256), // Vert
      Math.floor(Math.random() * 256)  // Bleu
    ];
  
    return randomColor;
  }
  
  
  export function generateEmptyAnnotation(latentElem,physicalElem){
    let newAnnotation = {
      id:Date.now()+generateRandomColor(),
      name:"noName",
      display:true,
      color:generateRandomColor(),
      latentTouched:latentElem,
      physicalTouched:physicalElem
    }
    return newAnnotation
  }
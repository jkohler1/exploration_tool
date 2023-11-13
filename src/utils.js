import * as turf from '@turf/turf';

export function getAllTilesInsideAnnotation(dimensions, updatedData,touchedData,mappingLatentPhysical) {
    console.log(mappingLatentPhysical)
    const tileSize = dimensions.tileSize;
    const imageWidth = dimensions.width;
    const imageHeight = dimensions.height;
    const maxZoomLevel = 16;
    const newFeature = updatedData.features[updatedData.features.length - 1];
  
    let touchedTilesTmp = touchedData;
    const zoom = maxZoomLevel;
  
    const tilesInX = Math.ceil(imageWidth / (tileSize * Math.pow(2, maxZoomLevel - zoom)));
    const tilesInY = Math.ceil(imageHeight / (tileSize * Math.pow(2, maxZoomLevel - zoom)));
    for (let x = 0; x < tilesInX; x++) {
      for (let y = 0; y < tilesInY; y++) {
        const centerX = (x + 0.5) * tileSize * Math.pow(2, maxZoomLevel - zoom);
        const centerY = (y + 0.5) * tileSize * Math.pow(2, maxZoomLevel - zoom);
  
        const point = turf.point([centerX, centerY]);
  
        if (turf.booleanPointInPolygon(point, newFeature) && x in mappingLatentPhysical.physicalToLatent && y in mappingLatentPhysical.physicalToLatent[x]) {
          // Créez une clé unique pour la tuile touchée
          touchedTilesTmp.push({ x: x * tileSize, y: y * tileSize });
        }
      }
    }
    return touchedTilesTmp;
  }

  export function getAllPointsInsideAnnotation(layerData, updatedData,touchedData) {
    const newFeature = updatedData.features[updatedData.features.length - 1];
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
  
  export function loadData(filePath) {
    return fetch(filePath)
      .then(response => response.text())
      .then(data => {
        const lines = data.split('\n');
        const layerData = lines.slice(1).map(line => {
          const [filename, umap_x, umap_y] = line.split(',');
          return {
            filename,
            umap_x: parseFloat(umap_x),
            umap_y: parseFloat(umap_y)
          };
        });
        return layerData;
      })
      .catch(error => {
        console.error(error);
        return null; // Vous pouvez retourner une valeur par défaut ou gérer l'erreur ici
      });
  }
  


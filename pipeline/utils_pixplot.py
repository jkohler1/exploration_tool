import os
import openslide as ops 
from openslide import deepzoom
import concurrent.futures
import numpy as np
from PIL import Image

def mkdir_if_not_exist(inputdir):
    if not os.path.exists(inputdir):
        os.makedirs(inputdir)
    return inputdir
    
    
def verif_path(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Couldn't finddddd the directory: {self.tiles_path}")

        
        
def basename_tuple(paths):
    paths_basename = []
    for i in paths:
        paths_basename.append(os.path.basename(i))
    return paths_basename


def save_tiles_for_tiling(input_file, output_folder_tiles, filename, tile_size, level):
    slide = ops.OpenSlide(input_file)
    tiles = deepzoom.DeepZoomGenerator(slide, tile_size=tile_size, overlap=0, limit_bounds=False)
    x_range = tiles.level_tiles[level][0]
    y_range = tiles.level_tiles[level][1]
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = []
        for x in range(x_range):
            for y in range(y_range):
                tile = tiles.get_tile(level, (x, y))
                tile_coordinates = tiles.get_tile_coordinates(level, (x, y))
                future = executor.submit(save_file, tile, output_folder_tiles, filename, tile_coordinates,x,y)
                futures.append(future)
        
        concurrent.futures.wait(futures)

    print(f"Processed level {level} for {input_file}")

def save_file(tile, output_folder_tiles, filename, tile_coordinates,x,y):
    tile_name = str(filename) + '_' + 'tile_%d_%d.png' % (x, y)
    tile_path = os.path.join(output_folder_tiles, tile_name)
    tile.save(tile_path, "PNG")



def save_file_lowres(tile,output_folder_tiles, filename, tile_coordinates,x,y):
    tile_name = str(filename) + '_' + 'tile_%d_%d.png' % (x, y)
    tile_path = os.path.join(output_folder_tiles, tile_name)
    tile.save(tile_path, "PNG")
    # Vérifiez que l'image existe
    
    #if os.path.exists(tile_path):
        # L'image existe, procédez avec la redimension
        #tile_path_redim_64 = os.path.join(output_folder_tiles_atlas64, tile_name)
        #tile_path_redim_128 = os.path.join(output_folder_tiles_atlas128, tile_name)

        #image = Image.open(tile_path)

        # Redimensionnez avec des dimensions valides
        #image_redim_64 = image.resize((64, 64), Image.ANTIALIAS)
        #image_redim_64.save(tile_path_redim_64)

        #image_redim_128 = image.resize((128, 128), Image.ANTIALIAS)
        #image_redim_128.save(tile_path_redim_128)

    #else:
        #print(f"Erreur: L'image {tile_path} n'existe pas.")


def save_tiles_for_max_lvl(input_file, output_folder_tiles, filename, tile_size, level , segmentation, bg_th,max_bg_frac):
        slide = ops.OpenSlide(input_file)
        tiles = deepzoom.DeepZoomGenerator(slide, tile_size=tile_size, overlap=0, limit_bounds=False)
        x_range = range(segmentation.shape[1])
        y_range = range(segmentation.shape[0])
        print(x_range)
        print(y_range)
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = []
            for x in x_range:
                for y in y_range:
                    if segmentation[y,x] == True:
                        try:
                            tile = tiles.get_tile(level, (x, y))
                            tile_coordinates = tiles.get_tile_coordinates(level, (x, y))
                            tile_np = np.array(tile)
                        except Exception as e:
                            print(f"Une erreur s'est produite lors de la récupération de la tuile : {e}")
                        if tile_np.shape[0] == tile_size and tile_np.shape[1] == tile_size: #check that tile == tile size
                            if is_on_edge(segmentation, y, x) == True :
                                if (tile_np.min(axis=2)>=bg_th).mean() <= max_bg_frac:
                                    future1 = executor.submit(save_file_lowres, tile, output_folder_tiles, filename, tile_coordinates,x,y)
                                    futures.append(future1)
                            else:
                                future1 = executor.submit(save_file_lowres, tile, output_folder_tiles,filename, tile_coordinates,x,y)
                                futures.append(future1)
            concurrent.futures.wait(futures)

            
        

def is_on_edge(segmentation, n, m):
    if segmentation[n, m-1]==False or segmentation[n, m+1]==False or segmentation[n-1, m]==False or segmentation[n+1, m]==False or segmentation[n-1, m-1]==False or segmentation[n+1, m+1]==False or segmentation[n-1, m+1]==False or segmentation[n+1, m-1]==False:
        rep = True
    else:
        rep = False
    return rep
    

    # Écrire les informations dans un fichier
def write_info_to_file(input_file, output_file,tile_size):
    # Open the SVS file
    slide = ops.OpenSlide(input_file)


    dimensions = slide.dimensions  # Total dimensions

    slide.close()

    # Write the information to an XML file
    with open(output_file, 'w') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"\n')
        f.write('  Format="jpeg"\n')
        f.write('  Overlap="0"\n')
        f.write(f'  TileSize="{tile_size}"\n')
        f.write('>\n')
        f.write(f'  <Size \n    Height="{dimensions[1]}"\n    Width="{dimensions[0]}"\n  />\n')
        f.write('</Image>\n')
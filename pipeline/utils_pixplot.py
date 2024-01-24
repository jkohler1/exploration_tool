import os
import openslide as ops 
from openslide import deepzoom
import concurrent.futures
import numpy as np
from PIL import Image
import shutil

# Function to create a directory if it doesn't exist
def mkdir_if_not_exist(inputdir):
    if not os.path.exists(inputdir):
        os.makedirs(inputdir)
    return inputdir

# Function to remove a directory if it exists
def remove_if_exist(inputdir):
    if os.path.exists(inputdir):
        shutil.rmtree(inputdir)
    return inputdir

# Function to copy content from source to destination
def copy_from_to(source_dir, destination_dir):
    try:
        if not os.path.exists(destination_dir):
            shutil.copytree(source_dir, destination_dir)
            print(f"Content from {source_dir} successfully copied to {destination_dir}")
        else:
            print(f"The destination directory {destination_dir} already exists. Copy is ignored.")
    except shutil.Error as e:
        print(f"Error during copy: {e}")
    except OSError as e:
        print(f"OS error during copy: {e}")

# Function to move content from source to destination
def move_from_to(source_dir, destination_dir):
    try:
        shutil.move(source_dir, destination_dir)
        print(f"Content from {source_dir} successfully moved to {destination_dir}")
    except shutil.Error as e:
        print(f"Error during move: {e}")
    except OSError as e:
        print(f"OS error during move: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# Function to move contents from source to destination
def move_contents_from_to(source_dir, destination_dir):
    try:
        for item in os.listdir(source_dir):
            source_item = os.path.join(source_dir, item)
            destination_item = os.path.join(destination_dir, item)
            if os.path.isdir(source_item):
                # Recursively move subdirectories
                shutil.move(source_item, destination_item)
            else:
                # Move individual files
                shutil.move(source_item, destination_item)
        print(f"Content from {source_dir} successfully moved to {destination_dir}")
    except shutil.Error as e:
        print(f"Error during move: {e}")
    except OSError as e:
        print(f"OS error during move: {e}")

# Function to verify if a path exists
def verif_path(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Couldn't find the directory: {self.tiles_path}")

# Function to get the basenames of paths
def basename_tuple(paths):
    paths_basename = []
    for i in paths:
        paths_basename.append(os.path.basename(i))
    return paths_basename

# Function to save tiles for tiling
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
                future = executor.submit(save_file, tile, output_folder_tiles, filename, tile_coordinates, x, y)
                futures.append(future)

        concurrent.futures.wait(futures)

    print(f"Processed level {level} for {input_file}")

# Function to save a file
def save_file(tile, output_folder_tiles, filename, tile_coordinates, x, y):
    tile_name = str(filename) + '_' + 'tile_%d_%d.png' % (x, y)
    tile_path = os.path.join(output_folder_tiles, tile_name)
    tile.save(tile_path, "PNG")

# Function to save a low-resolution file
def save_file_lowres(tile, output_folder_tiles, filename, tile_coordinates, x, y):
    tile_name = str(filename) + '_' + 'tile_%d_%d.png' % (x, y)
    tile_path = os.path.join(output_folder_tiles, tile_name)
    tile.save(tile_path, "PNG")

# Function to save tiles for the maximum level
def save_tiles_for_max_lvl(input_file, output_folder_tiles, filename, tile_size, level, segmentation, bg_th, max_bg_frac):
    slide = ops.OpenSlide(input_file)
    tiles = deepzoom.DeepZoomGenerator(slide, tile_size=tile_size, overlap=0, limit_bounds=False)
    x_range = range(segmentation.shape[1])
    y_range = range(segmentation.shape[0])
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = []
        for x in x_range:
            for y in y_range:
                if segmentation[y, x] == True:
                    try:
                        tile = tiles.get_tile(level, (x, y))
                        tile_coordinates = tiles.get_tile_coordinates(level, (x, y))
                        tile_np = np.array(tile)
                    except Exception as e:
                        print(f"An error occurred while retrieving the tile: {e}")
                    if tile_np.shape[0] == tile_size and tile_np.shape[1] == tile_size:  # check that tile == tile size
                        if is_on_edge(segmentation, y, x) == True:
                            if (tile_np.min(axis=2) >= bg_th).mean() <= max_bg_frac:
                                future1 = executor.submit(save_file_lowres, tile, output_folder_tiles, filename, tile_coordinates, x, y)
                                futures.append(future1)
                        else:
                            future1 = executor.submit(save_file_lowres, tile, output_folder_tiles, filename, tile_coordinates, x, y)
                            futures.append(future1)
        concurrent.futures.wait(futures)

# Function to check if a pixel is on the edge
def is_on_edge(segmentation, n, m):
    if segmentation[n, m-1] == False or segmentation[n, m+1] == False or segmentation[n-1, m] == False or segmentation[n+1, m] == False or segmentation[n-1, m-1] == False or segmentation[n+1, m+1] == False or segmentation[n-1, m+1] == False or segmentation[n+1, m-1] == False:
        rep = True
    else:
        rep = False
    return rep

# Function to write information to a file
def write_info_to_file(input_file, output_file, tile_size, nb_lvl):
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
        f.write(f'  NbLvl="{nb_lvl}"\n')
        f.write('>\n')
        f.write(f'  <Size \n    Height="{dimensions[1]}"\n    Width="{dimensions[0]}"\n  />\n')
        f.write('</Image>\n')

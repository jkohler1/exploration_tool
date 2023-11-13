import os
import json
from utils import *
from multiprocessing import Pool, cpu_count

def generate_physical_space(input_files,output_folder):
    print(input_files)
    print(output_folder)
    mkdir_if_not_exist(output_folder)
    # Multiprocessing parallelization for multifiles 
    num_processes = min(cpu_count(), len(input_files))
    with Pool(num_processes) as pool:
        pool.starmap(generate_deepzoom, [(input_file, output_folder) for input_file in input_files])


def generate_deepzoom(input_file, output_folder, tile_size=256):
    """
    Génère une image DeepZoom pour un fichier d'entrée donné.
    """
    slide = ops.OpenSlide(input_file)
    tiles = ops.deepzoom.DeepZoomGenerator(slide, tile_size=tile_size, overlap=0, limit_bounds=False)
    
    output_file = os.path.join(output_folder, os.path.basename(input_file) + ".dzi")
    tiles.get_dzi("jpeg").save(output_file)
    print(f"Processed {input_file}")


if __name__ == '__main__':
    current_folder = os.getcwd()
    config = json.load(open(os.path.join(current_folder, 'config.json'), "r"))
    generate_physical_space(config.slide, config.tile_phys_dir)
    json.dump(config, open(os.path.join(current_folder, 'config.json'), "w"), indent=2)
        


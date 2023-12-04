import os
import json
from utils_pixplot import *
from Slide import SlidePixplot
from Model import ModelPixplot
from multiprocessing import Pool, cpu_count
import numpy as np


        
def pipeline(config):
    mkdir_if_not_exist(config['output_dir'])
    if config['tiling']:
        slide_path = config['slide']
        inference_inputs = generate_physical_space(slide_path, config['output_dir'])
    else:
        inference_inputs_folder = config['inference_inputs']
        inference_inputs = []
        if os.path.isfile(inference_inputs_folder): #only one file
            inference_inputs.append(os.path.dirname(inference_inputs_folder))
        else : 
            files = [f for f in os.listdir(inference_inputs_folder) if os.path.isfile(os.path.join(inference_inputs_folder, f))]#take all file inside folder and remove potential subfolder
            for file in files:
                inference_inputs.append(os.path.dirname(file))
    if config['inference']: 
        if config['tiling']: #there exist a path to input inference folder
           model_application(inference_inputs,config['dimensionality_reduction'],config['model_type'],config['model_name'],config['processing_unit'],config['batch_size'],config['num_workers'],config['tile_resize'],config['tile_size'],config['output_dir'],True,config['default_clustering'])
        
        
def generate_physical_space(input_files, output_folder):
    print("start generating physical space")
    output_physical_space_global = os.path.join(output_folder, 'tiling')  # Chemin global du dossier de sortie
    mkdir_if_not_exist(output_physical_space_global)
    inference_inputs = []
    for input_file in input_files:
        if os.path.isfile(input_file):  #is a file
            filename = os.path.basename(input_file)  # Obtenir le nom du fichier à partir du chemin complet
            output_physical_space_current = os.path.join(output_physical_space_global, filename)  # Chemin du dossier de sortie spécifique
            mkdir_if_not_exist(output_physical_space_current)
            slide_pixplot = SlidePixplot(input_file, output_physical_space_current,filename)
            inference_input_dir = os.path.dirname(slide_pixplot.inference_input)
            inference_inputs.append(inference_input_dir)
    return inference_inputs



def model_application(inference_inputs,dimensionality_reduction,model_type, model_name, processing_unit, batch_size, num_workers, tile_resize, tile_size,output_folder, input_from_tiling,default_clustering):
    output_inference_global = os.path.join(output_folder, 'model')
    mkdir_if_not_exist(output_inference_global)
    for inference_input in inference_inputs:     
        print(inference_input)
        output_inference_current = os.path.join(output_inference_global)
        if input_from_tiling:
            ModelPixplot(inference_input,dimensionality_reduction,output_inference_current,model_type, model_name, processing_unit, 
                 batch_size, num_workers, tile_resize, tile_size,default_clustering)

if __name__ == '__main__':
    current_folder = os.getcwd()
    config = json.load(open(os.path.join(current_folder, 'config.json'), "r"))
    pipeline(config)
    json.dump(config, open(os.path.join(current_folder, 'config.json'), "w"), indent=2)
import os
import pandas as pd
import numpy as np
import sys
import time
import re
import pickle
import torch
import torchvision
import clip
import matplotlib as mpl
import openslide as ops
from openslide import deepzoom

        
def extract_folder_name(path):
    if path[-1] == '/':
        path = path[:-1]
    folder_name = os.path.basename(path)
    return folder_name

def make_pixplot_out_dir_all(**config):
    project_dir = config['project_dir']
    random_n = config['n']
    #print(config['slide'][0])
    #print(os.path.basename(config['slide'][0]))
    pixplot_out_dir_all_path = os.path.join(project_dir, extract_folder_name(config['slide'][0]) + '_' + str(random_n))
    print(pixplot_out_dir_all_path)
    mkdir_if_not_exist(pixplot_out_dir_all_path)
    return pixplot_out_dir_all_path

def main_tiling(**config):
    print("The tiling procedure has started.") 
    for images_path in config['slide']:
        isFile = os.path.isfile(images_path)
        isDirectory = os.path.isdir(images_path)
        tiles_path = config['tile_dir']
        mkdir_if_not_exist(tiles_path)
        tile_size = config['tile_size'] 
        tiling_nw = config['tiling_nw']
        max_bg_frac = config['max_bg_frac']
        seg = config['seg']
        npdi = config['npdi']

        if isFile == True:
            dic={'SlideisFile': True}
            print("The slide: " + images_path + " will be tiled")
            t0 = time.time()
            try:
                TileSVS_and_crop_using_deepzoom(images_path, tiles_path, tile_size, tiling_nw, max_bg_frac, seg, npdi)
            except:
                savedir = config['pyramid_dir']
                pyramid_im = make_pyramid(images_path, savedir, tile_size)
                TileSVS_and_crop_using_deepzoom(pyramid_im, tiles_path, tile_size, tiling_nw, max_bg_frac, seg, npdi)
            tf = time.time() - t0
            print(f'Tiling time: {tf:.2f}s')

        elif isDirectory == True:
            print("All the slides from the directory: " + images_path + " will be tiled")
            pixplot_out_dir_all_path = make_pixplot_out_dir_all(**config)
            dic={'SlideisFile': False, 'pixplot_out_dir_all': pixplot_out_dir_all_path}
            for file in os.listdir(images_path):
                t0 = time.time()
                if not file.startswith('.'):
                    path = os.path.join(images_path, file)
                    try:
                        TileSVS_and_crop_using_deepzoom(path, tiles_path, tile_size, tiling_nw, max_bg_frac, seg, npdi)
                    except:
                        savedir = config['pyramid_dir']
                        pyramid_im = make_pyramid(path, savedir, tile_size)
                        TileSVS_and_crop_using_deepzoom(pyramid_im, tiles_path, tile_size, tiling_nw, max_bg_frac, seg, npdi)
                tf = time.time() - t0
                print(f'Tiling time for {file}: {tf:.2f}s')
    config.update(dic)
    return config


def main_model(**config):
    config = check_model(**config)
    model_name = config['model_name']
    tiles_path = config['tile_dir']
    results_path = config['latent_dir']
    processing_unit = config['processing_unit']
    batch_size = config['batch_size']
    num_workers = config['num_workers']
    tile_resize = config['tile_resize']
    tile_size = config['tile_size']

    if config['no_valid_model'] == False:
        print('\n' + model_name + ' Latent space comptation has started.')

        isFile = os.path.isfile(tiles_path)
        isDirectory = os.path.isdir(tiles_path)
        
        if config['timm_model'] != None or config['dino_model'] != None or config['dino2_model'] != None or config['clip_model'] != None :
            import timm
            if config['timm_model'] != None:
                model = timm.create_model(model_name, pretrained=True, num_classes=0)
            elif config['dino_model'] != None:
                model = torch.hub.load('facebookresearch/dino:main', f'dino_{model_name}')
            elif config['dino2_model'] != None:
                model = torch.hub.load('facebookresearch/dinov2', f'dinov2_{model_name}')
            elif config['clip_model'] != None:
                model, preprocess = clip.load(model_name)
            if processing_unit != "cpu":
                torch.cuda.empty_cache()
                print("GPU are used")
                cuda_unit = torch.device(processing_unit) 
                model = model.cuda(cuda_unit)
                model.eval() 

        elif config['model'] != None:
            model = torchvision.models.__dict__['resnet18'](pretrained=False)
            model_path = config['model']
            #model_name = os.path.basename(model_path)
            if processing_unit != "cpu":
                print("GPU are used")
                #change1
                torch.cuda.empty_cache()
                cuda_unit = torch.device(processing_unit) 
                state = torch.load(model_path, map_location=processing_unit)
                state_dict = state['state_dict']        
                for key in list(state_dict.keys()):
                    state_dict[key.replace('model.', '').replace('resnet.', '')] = state_dict.pop(key)
                model = load_model_weights(model, state_dict)
                model.fc = torch.nn.Sequential()
                #change2
                model = model.cuda(cuda_unit)
            else:
                print("CPU are used")
                state = torch.load(model_path, map_location=torch.device(processing_unit))
                state_dict = state['state_dict']
                for key in list(state_dict.keys()):
                    state_dict[key.replace('model.', '').replace('resnet.', '')] = state_dict.pop(key)
                model = load_model_weights(model, state_dict)
                model.fc = torch.nn.Sequential()


        if isFile == True:
            dic={'SlideisFile': True}
            t0 = time.time()
            data = apply_model(model, model_name, cuda_unit, tiles_path, results_path, processing_unit, batch_size, num_workers, tile_resize, tile_size)
            tf = time.time() - t0
            print(f'Inference time: {tf:.2f}s')

        elif isDirectory == True:
            dic={'SlideisFile': False}
            if config['pixplot_out_dir_all'] == None and config['slide'] != None:
                pixplot_out_dir_all_path = make_pixplot_out_dir_all(**config)
                dic['pixplot_out_dir_all'] = pixplot_out_dir_all_path
                #print(dic)
            for file in os.listdir(tiles_path):
                t0 = time.time()
                path = os.path.join(tiles_path, file)
                data = apply_model(model, model_name, cuda_unit, path, results_path, processing_unit, batch_size, num_workers, tile_resize, tile_size)
                tf = time.time() - t0
                print(f'Inference time for {file}: {tf:.2f}s')
        config.update(dic)
    return config

def check_model(**config):
    model_name = ''
    if config['timm_model'] != None or config['dino_model'] != None or config['dino2_model'] != None or config['model'] != None or config['clip_model'] !=None :
        if config['timm_model'] != None and config['model'] == None and config['dino_model'] == None and config['dino2_model'] == None and config['clip_model'] == None:
            model_name = config['timm_model']
            dic={'model_name': model_name}
        elif config['model'] != None and config['timm_model'] == None and config['dino_model'] == None and config['dino2_model'] == None and config['clip_model'] == None :
            model_path = config['model']
            model_name = os.path.basename(model_path)
            dic={'model_name': model_name}
        elif config['dino_model'] != None and config['dino2_model'] == None and config['timm_model'] == None and config['model'] == None and config['clip_model'] == None :
            model_name = config['dino_model']
            dic={'model_name': model_name}
        elif config['dino2_model'] != None and config['dino_model'] == None and config['timm_model'] == None and config['model'] == None and config['clip_model'] == None :
            model_name = config['dino2_model']
            dic={'model_name': model_name}
        elif config['clip_model'] != None and config['timm_model'] == None and config['dino_model'] == None and config['model'] == None :
            model_name = config['clip_model']
            dic={'model_name': model_name}
    else:
        print('More than one or no valid model specified')
        dic={'no_valid_model': True}
    config.update(dic)
    return config
        
def main_pixplot_input(**config):
    if config['model_name'] == None and config['no_valid_model'] == False:
        config = check_model(**config)
    if config['no_valid_model'] == False:
        print("The pixplot input file is being generated.")  
        t0 = time.time()
        config = pixplot(**config)
        tf = time.time() - t0
        print(f'Pixplot input file generation time: {tf:.2f}s')
    return config

def make_pyramid(path, savedir, tile_size):
    import tifffile
    import cv2
    image = tifffile.imread(path, key=0)
    h, w, s = image.shape
    slide_name = os.path.basename(path)
    mkdir_if_not_exist(savedir)
    save_path = os.path.join(savedir, slide_name)
    with tifffile.TiffWriter(save_path, bigtiff=True) as tif:
        level = 0
        while True:
            tif.save(
                image,
                software='Glencoe/Faas pyramid',
                metadata=None,
                tile=(tile_size, tile_size),
                resolution=(1000/2**level, 1000/2**level, 'CENTIMETER'),
                # compress=1,  # low level deflate
                # compress=('jpeg', 95),  # requires imagecodecs
                # subfiletype=1 if level else 0,
            )
            if max(w, h) < 256:
                break
            level += 1
            w //= 2
            h //= 2
            image = cv2.resize(image, dsize=(w, h), interpolation=cv2.INTER_LINEAR)
    print(f"A pyramid version of the input image has been made in {savedir}.") 
    return save_path

def TileSVS_and_crop_using_deepzoom(File, outdir, tile_size, tiling_nw, max_bg_frac, seg = True, npdi= False, SaveToFile=True, tile_level_step_down=1,
                                     ProgressBarObj=None, no_cropping=False):
    
    Slide = ops.OpenSlide(File) 

    pixel_size = 'Unknown'
    if "openslide.mpp-x" in Slide.properties:
        pixel_size = str(round(float(Slide.properties['openslide.mpp-x'][0:6]),2))
    elif 'tiff.ImageDescription' in Slide.properties and pixel_size == 'Unknown_pixel_size':
        pixel_size = str(round(10000/float(Slide.properties['tiff.XResolution']),2))
    
    slide_name = os.path.basename(File)
    outdir = outdir + "/" + pixel_size + "_" + slide_name

    tiles = ops.deepzoom.DeepZoomGenerator(Slide, tile_size=tile_size, overlap=0, limit_bounds=False)
    
    assert (np.round(np.array(tiles.level_dimensions[-1]) / np.array(tiles.level_dimensions[-2])) == 2).all(), \
        'level_dimension[-2] should be almost twice smaller than level_dimension[-1] for proper conversion between 20x<->40x'
    
    mkdir_if_not_exist(outdir) 
    

    SaveToFolder = outdir + '/preprocessing/'
    mkdir_if_not_exist(SaveToFolder)
    tilesdir = outdir + '/processing/tiles/' #/processing added
    mkdir_if_not_exist(tilesdir)

    tile_level = tiles.level_count - tile_level_step_down # level_count: The number of Deep Zoom levels in the image.
    tile_count = tiles.level_tiles[tile_level] # level_tiles: A list of (tiles_x, tiles_y) tuples for each Deep Zoom level. level_tiles[k] are the tile counts of level k.

   
    print("seg", seg)

    segmentation, bg_th = CropSlideCoordRatiosV4(Slide, thumbnail_size = (tile_count[0],tile_count[1]), seg = seg, npdi = npdi, SaveToFolder = SaveToFolder)
    general_path = SaveToFolder + '/general.csv'
    
    fi = open(general_path, 'w')
    #print("Slide.properties: ", Slide.properties)
    for prop in Slide.properties:
        prop_value = Slide.properties[prop]
        if '\r\n' in prop_value:
            prop_value = prop_value.replace('\r\n'," ")
        if ',' in prop_value:
            #print(prop_value)
            prop_value = prop_value.replace(',',"comma")
        fi.write(f"{prop}")
        fi.write(",")
        fi.write(f"{prop_value}")
        fi.write('\n') 

    fi.write("slide_dimension_0" + "," + str(Slide.dimensions[0]))
    fi.write('\n')
    fi.write("slide_dimension_1" + "," + str(Slide.dimensions[1]))
    fi.write('\n')
    fi.write("tile_size" + "," + str(tile_size))
    fi.write('\n')
    fi.write("number_of_tiles_in_original_slide_0" + "," + str(tile_count[0]))
    fi.write('\n')
    fi.write("number_of_tiles_in_original_slide_1" + "," + str(tile_count[1]))
    fi.write('\n')
    fi.write("number_of_tiles_in_preprocessed_slide[0]" + "," + str(segmentation.shape[0]))
    fi.write('\n')
    fi.write("number_of_tiles_in_preprocessed_slide[1]" + "," + str(segmentation.shape[1]))
    fi.write('\n')
    fi.close()

    x_range = range(segmentation.shape[1])
    y_range = range(segmentation.shape[0])
    
    from multiprocessing import Pool
    print('tiling_nw : ', tiling_nw)
    print("bg_th: ", bg_th)
    print("max_bg_frac: ", max_bg_frac)
    executor = Pool(tiling_nw)
  
    for m in x_range:
        executor.apply_async(doRange, (File, tile_level, m, slide_name, tilesdir, y_range, SaveToFolder, segmentation, tile_size, SaveToFile, bg_th, max_bg_frac))
    executor.close()
    executor.join()
    Slide.close()

def doRange(File, tile_level, m, slide_name, tilesdir, y_range, SaveToFolder, segmentation, tile_size, SaveToFile, bg_th, max_bg_frac):
    import openslide as ops
    from openslide import deepzoom
    Slide = ops.OpenSlide(File) 
    tiles = ops.deepzoom.DeepZoomGenerator(Slide, tile_size=tile_size, overlap=0, limit_bounds=False)
    #print(type(tiles))
    #Pbar = ProgressBar(num_tiles, step=1)
    
    for n in y_range:
        #Pbar.NestedUpdate('(%d/%d,%d/%d)' % (m, Xdims[0], n, Xdims[1]), ProgressBarObj=ProgressBarObj)
        tile = tiles.get_tile(tile_level, (m, n))
        tile_coordinates = tiles.get_tile_coordinates(tile_level, (m, n))
        if SaveToFile:
            if segmentation[n,m] == True:
                tile_np = np.array(tile)
                if tile_np.shape[0] == tile_size and tile_np.shape[1] == tile_size:
                    #print(tile_np.shape[1])
                    #print(tile_np.shape[0])
                    if is_on_edge(segmentation, n, m) == True:
                        if (tile_np.min(axis=2)>=bg_th).mean() <= max_bg_frac:
                            tile_name = str(slide_name) + '_' + 'tile_%d_%d.png' % (tile_coordinates[0][0], tile_coordinates[0][1])
                            outfile = tilesdir + tile_name 
                            tile.save(outfile, "PNG", quality=100)
                            coordinates_path = SaveToFolder + '/coordinates.csv'
                            fi = open(coordinates_path, 'a')  
                            fi.write(tile_name + "," + str(tile_coordinates[0][0]) + "," + str(tile_coordinates[0][1]) + '\n')
                            fi.close()
                    else:
                        tile_name = str(slide_name) + '_' + 'tile_%d_%d.png' % (tile_coordinates[0][0], tile_coordinates[0][1])
                        outfile = tilesdir + tile_name 
                        tile.save(outfile, "PNG", quality=100)
                        coordinates_path = SaveToFolder + '/coordinates.csv'
                        fi = open(coordinates_path, 'a')  
                        fi.write(tile_name + "," + str(tile_coordinates[0][0]) + "," + str(tile_coordinates[0][1]) + '\n')
                        #fi.write(str(slide_name) + '_' + 'tile_%d_%d.png' % (m, n) + "," + str(m) + "," + str(n) + "," + str(tile_coordinates[0][0]) + "," + str(tile_coordinates[0][1]) + "," + '\n')
                        fi.close()
        else:
            tile = np.array(tile)
            [m, n, :tile.shape[0], :tile.shape[1], :] = tile


def is_on_edge(segmentation, n, m):
    if (segmentation[n, m-1]==False and segmentation[n, m-2]==False) or (segmentation[n, m+1]==False and segmentation[n, m+2]==False) or (segmentation[n-1, m]==False and segmentation[n-2, m]==False) or (segmentation[n+1, m]==False and segmentation[n+2, m]==False) or (segmentation[n-1, m-1]==False and segmentation[n-2, m-2]==False) or (segmentation[n+1, m+1]==False and segmentation[n+2, m+2]==False):
        rep = True
    else:
        rep = False
    return rep


    
def apply_model(model, model_name, cuda_unit, tiles_path, results_path, processing_unit, batch_size, num_workers, tile_resize, tile_size):   
    #resnet
    #import requests #?
    #import json #?
    #import openslide  #to clean
    import torch
    import torchvision
    from torch.utils.data import DataLoader
    from torchvision import datasets
    from torchvision.datasets import ImageFolder
    from torchvision.transforms import ToTensor
    from torchvision import transforms
    import clip
    
    #t0 = time.time()
    
    image_name_full = os.path.basename(tiles_path)
    #print(image_name_full)
    #image_name = re.split('_',image_name_full)[1]
    pixel_size = re.split('_',image_name_full)[0]
    image_name = image_name_full.replace(pixel_size+"_","")
    print(image_name)
    #print(os.path.isfile(model_name))

    """if os.path.isfile(model_name)==False:
        import timm
        #model = timm.create_model(model_name, pretrained=True, num_classes=0)
        if processing_unit != "cpu":
            print("GPU are used")
            cuda_unit = torch.device(processing_unit) 
            model = model.cuda(cuda_unit)
    
    elif os.path.isfile(model_name)==True:
        model = torchvision.models.__dict__['resnet18'](pretrained=False)
        model_path = config['model']
        model_name = os.path.basename(model_path)
        if processing_unit != "cpu":
            print("GPU are used")
            #change1
            cuda_unit = torch.device(processing_unit) 
            state = torch.load(model_path, map_location=processing_unit)
            state_dict = state['state_dict']        
            for key in list(state_dict.keys()):
                state_dict[key.replace('model.', '').replace('resnet.', '')] = state_dict.pop(key)
            model = load_model_weights(model, state_dict)
            model.fc = torch.nn.Sequential()
            #change2
            model = model.cuda(cuda_unit)
        else:
            print("CPU are used")
            state = torch.load(model_path, map_location=torch.device(processing_unit))
            state_dict = state['state_dict']
            for key in list(state_dict.keys()):
                state_dict[key.replace('model.', '').replace('resnet.', '')] = state_dict.pop(key)
            model = load_model_weights(model, state_dict)
            model.fc = torch.nn.Sequential()"""

    class ImageFolderWithPaths(datasets.ImageFolder):
        # override the __getitem__ method. this is the method that dataloader calls
        def __getitem__(self, index):
            # this is what ImageFolder normally returns 
            original_tuple = super(ImageFolderWithPaths, self).__getitem__(index)
            # the image file path is added
            path = self.imgs[index][0]
            # make a new tuple that includes original and the path
            tuple_with_path = (original_tuple + (path,))
            return tuple_with_path
    if tile_size == tile_resize:
        dataset = ImageFolderWithPaths(tiles_path + "/processing", transform=ToTensor())
    else:
        dataset = ImageFolderWithPaths(tiles_path + "/processing", transform=transforms.Compose([transforms.Resize(tile_resize), transforms.ToTensor()]))
        print('tile_resize: ', tile_resize)
    print('batch_size: ', batch_size)
    print('num_workers: ', num_workers)
    dataload = DataLoader(dataset, batch_size=batch_size, num_workers=num_workers, shuffle=False)
    model_name2 = model_name
    if '/' in model_name:
        #model_name2 = model_name.replace("/","\/")
        model_name2 = model_name.replace("/","_")
    file_path = results_path + "/" + pixel_size + "/" + model_name2 + "/" + image_name + "/"
    mkdir_if_not_exist(file_path)

    for i, (images, labels, paths) in enumerate(dataload):
#        print(i)
        if processing_unit != "cpu":
            images = images.cuda(cuda_unit)
        if model_name in ['RN50', 'RN101', 'RN50x4', 'RN50x16', 'RN50x64', 'ViT-B/32', 'ViT-B/16', 'ViT-L/14', 'ViT-L/14@336px']:
            with torch.no_grad():
                repLat = model.encode_image(images).float()
        else:
            repLat = model(images)
        array = repLat.detach().cpu().numpy()
        torch.cuda.empty_cache()
        #print(array)
        df = pd.DataFrame(array)
        #df.insert(0, "tile_name", os.path.basename(paths[0:(batch_size+1)]))

        paths_basename = basename_tuple(paths[0:(batch_size+1)])
        df.insert(0, "tile_name", paths_basename)
        df.insert(1, "image_name", image_name)
        if i == 0:
            data = df
        else:
            data = pd.concat([data,df])
    print("latent_space_dimension: ", data.shape)
    data.index = data['tile_name']
    data = data.drop(['tile_name'], axis = 1)

    data.to_csv(file_path + "_repLat" + model_name2 + ".csv", header=False)
    #tf = time.time() - t0
    #print(f'inference time: {tf:.2f}s')
    return data

def basename_tuple(paths):
    paths_basename = []
    for i in paths:
        paths_basename.append(os.path.basename(i))
    return paths_basename

def load_model_weights(model, weights):

    model_dict = model.state_dict()
    weights = {k: v for k, v in weights.items() if k in model_dict}
    if weights == {}:
        print('No weight could be loaded..')
    model_dict.update(weights)
    model.load_state_dict(model_dict)

    return model

def mkdir_if_not_exist(inputdir):
    if not os.path.exists(inputdir):
        os.makedirs(inputdir)
    return inputdir

"""def model_name_from_latent_dir(**config):
    latent_space_folder = config['latent_dir']
    count = 0
    for folder in os.listdir(latent_space_folder):
        print(folder)
        folder = os.path.join(latent_space_folder, folder)
        for model_folder in os.listdir(folder):
            print(model_folder)
            count += 1
    if count == 1:
        return model_folder
    else:
        print('no valid model specified')"""
            

"""def check_model_pixplot(**config):
    model_name = ''
    if config['timm_model'] != None or config['dino_model'] != None or config['model'] != None:
        if config['timm_model'] != None and config['model'] == None and config['dino_model'] == None :
            model_name = config['timm_model']
            dic={'model_name': model_name}
        elif config['model'] != None and config['timm_model'] == None and config['dino_model'] == None :
            model_path = config['model']
            model_name = os.path.basename(model_path)
            dic={'model_name': model_name}
        elif config['dino_model'] != None and config['timm_model'] == None and config['model'] == None :
            model_name = config['dino_model']
            dic={'model_name': model_name}
        elif config['model'] != None and config['timm_model'] != None :
            print('Two models specified, only one permitted')
            dic={'no_valid_model': True}
        elif config['model'] != None and config['dino_model'] != None :
            print('Two models specified, only one permitted')
            dic={'no_valid_model': True}
        elif config['timm_model'] != None and config['dino_model'] != None :
            print('Two models specified, only one permitted')
            dic={'no_valid_model': True}
    else:
        print('no valid model specified')
        dic={'no_valid_model': True}
    config.update(dic)
    return config"""


def pixplot(**config):
    if config['model_name'] == None and config['no_valid_model'] == False:
        config = check_model(**config)
    model_name = config['model_name']
    all_pixel_slides = []
    all_slide_names = []
    all_pixel_sizes = []
    all_pixel_input_files = []
    all_latent_space_files = []
    all_coordinates_files = []
    all_tiles_metadata_files = []
    all_slide_thumbnail_files =[]
    all_pixplot_input_files = []
    
    for file in os.listdir(config['tile_dir']):
        path = os.path.join(config['tile_dir'], file)
        pixel_slide = os.path.basename(path)
        #slide_name = re.split('_',pixel_slide)[1]
        pixel_size = re.split('_',pixel_slide)[0]
        slide_name = pixel_slide.replace(pixel_size+"_","")
        print(slide_name)
        model_name2 = model_name
        if '/' in model_name:
            #model_name2 = model_name.replace("/","\/")
            model_name2 = model_name.replace("/","_")
            latent_suffix = pixel_size + '/' + model_name2 + '/' + slide_name + '/' + '_repLat' + model_name2 + '.csv'
        else:
            latent_suffix = pixel_size + '/' + model_name + '/' + slide_name + '/' + '_repLat' + model_name + '.csv'
        latent_space_file = os.path.join(config['latent_dir'], latent_suffix)
        coordinates_suffix = pixel_slide + '/preprocessing/coordinates.csv'
        coordinates_file = os.path.join(config['tile_dir'], coordinates_suffix)
        #general_suffix = pixel_slide + '/preprocessing/general.csv'
        #tiles_metadata_file = os.path.join(config['tile_dir'], general_suffix)
        slide_thumbnail_suffix = pixel_slide + '/preprocessing/slide.png'
        slide_thumbnail_file = os.path.join(config['tile_dir'], slide_thumbnail_suffix)
        if '/' in model_name:
            pixplot_input_folder_suffix = pixel_size + '/' + model_name2 + '/' + slide_name
        else:
            pixplot_input_folder_suffix = pixel_size + '/' + model_name + '/' + slide_name 
        pixplot_input_file_suffix = pixplot_input_folder_suffix + '/' + 'pixplot_metadata.csv' 
        pixplot_input_folder = os.path.join(config['pixplot_in_dir'], pixplot_input_folder_suffix)
        #print(pixplot_input_folder)
        mkdir_if_not_exist(pixplot_input_folder)
        pixplot_input_file = os.path.join(pixplot_input_folder, 'pixplot_metadata.csv')
        all_pixel_slides.append(pixel_slide)
        all_slide_names.append(slide_name)
        all_pixel_sizes.append(pixel_size)
        all_pixel_input_files.append(pixplot_input_file)
        all_latent_space_files.append(latent_space_file)
        all_coordinates_files.append(coordinates_file)
        #all_tiles_metadata_files.append(tiles_metadata_file)
        all_slide_thumbnail_files.append(slide_thumbnail_file)
        all_pixplot_input_files.append(pixplot_input_file)
        
        """dic = {
        'all_pixel_slides': all_pixel_slides,
        'all_slide_names': all_slide_names,
        'all_pixel_sizes': all_pixel_sizes,
        'all_pixel_input_files': all_pixel_input_files,
        'all_latent_space_files': all_latent_space_files,
        'all_coordinates_files': all_coordinates_files,
        'all_tiles_metadata_files': all_tiles_metadata_files,
        'all_slide_thumbnail_files': all_slide_thumbnail_files,
        'all_pixplot_input_files': all_pixplot_input_files
        }"""
        dic = {
        'all_pixel_slides': all_pixel_slides,
        'all_slide_names': all_slide_names,
        'all_pixel_sizes': all_pixel_sizes,
        'all_pixel_input_files': all_pixel_input_files,
        'all_latent_space_files': all_latent_space_files,
        'all_coordinates_files': all_coordinates_files,
        'all_slide_thumbnail_files': all_slide_thumbnail_files,
        'all_pixplot_input_files': all_pixplot_input_files
        }
        
        config.update(dic)
        pixplot_input_generation(**config)
    return config


def pixplot_input_generation(**config):
    import umap.umap_ as umap
    count = len(config['all_slide_names'])
    for i in range(count):
        latent_space_file = config['all_latent_space_files'][i]
        coordinates_file = config['all_coordinates_files'][i]
        #tiles_metadata_file = config['all_tiles_metadata_files'][i]
        pixplot_input_file = config['all_pixplot_input_files'][i]
        latent = pd.read_csv(latent_space_file, header=None, index_col=0)
        latent = latent.drop(columns=[1])
        latent = latent.sort_index()
        #print(latent.shape)

        coordinates = pd.read_csv(coordinates_file, header=None, index_col=0)
        #print(coordinates.head())
        coordinates.columns = ['x.pixel', 'y.pixel']
        coordinates = coordinates.sort_index()
        #print(coordinates.shape)

        #tiles_meta_data = readcsv(tiles_metadata_file)

        # Make and plot UMAP
        reducer = umap.UMAP()
        embedding = reducer.fit_transform(latent)
        #print(embedding.shape)

        pixplot_data = pd.DataFrame({'filename': latent.index,
                                     'lat' : 1 + max(coordinates['y.pixel'])/config['tile_size'] - coordinates['y.pixel']/config['tile_size'],
                                     'lng' : coordinates['x.pixel']/config['tile_size'],
                                    'umap_x' : embedding[:, 0], 'umap_y' : embedding[:, 1]})

        pixplot_data.to_csv(pixplot_input_file, index=False)
        
        """coordinates = coordinates.drop(columns=[5])
        coordinates.columns = ['x.tile', 'y.tile', 'x.pixel', 'y.pixel']
        coordinates = coordinates.sort_index()
        #print(coordinates.shape)

        #tiles_meta_data = readcsv(tiles_metadata_file)

        # Make and plot UMAP
        reducer = umap.UMAP()
        embedding = reducer.fit_transform(latent)
        #print(embedding.shape)

        pixplot_data = pd.DataFrame({'filename': latent.index,
                                     'lat' : 1 + max(coordinates['y.tile']) - coordinates['y.tile'],
                                     'lng' : coordinates['x.tile'],
                                    'umap_x' : embedding[:, 0], 'umap_y' : embedding[:, 1]})

        pixplot_data.to_csv(pixplot_input_file, index=False)"""

def readcsv(file):
    df=pd.read_csv(file, header=None, sep='\n')
    df['attribute'] = pd.DataFrame(list(df[0].str.split(',')))[0].values
    df['value'] = pd.DataFrame(list(df[0].str.split(',')))[1].values
    df.index=df['attribute']
    df=df.drop(columns=[0, 'attribute'])
    df=df.T
    return df 


def process_images(**config):
    if config['tiling']==True:
        config = main_tiling(**config)
    if config['inference']==True:
        config = main_model(**config)
    if config['pixplot']==True:
        config = main_pixplot_input(**config)
    return config
        
import json
if __name__ == '__main__':
    current_folder = os.getcwd()
    """config = pickle.load(open(os.path.join(current_folder, 'config.txt'), "rb"))
    config = process_images(**config)
    pickle.dump(config, open(os.path.join(current_folder, 'config.txt'), "wb"))"""
    config = json.load(open(os.path.join(current_folder, 'config.json'), "r"))
    #print(config)
    config = process_images(**config)
    json.dump(config, open(os.path.join(current_folder, 'config.json'), "w"), indent=2)
        



        
        

import os
from utils_pixplot import *
import openslide as ops 
from openslide import deepzoom
from multiprocessing import Pool, cpu_count
import matplotlib as mpl
import skimage.color as skc
from skimage.filters import threshold_triangle
from skimage.morphology import disk, binary_opening, binary_closing, binary_dilation,convex_hull_object
from skimage.filters import threshold_multiotsu
from skimage import measure
import matplotlib.pyplot as pl
import numpy as np
import math


class SlidePixplot:
    def __init__(self,input_file,output_folder,filename):
        self.input_file = input_file
        self.output_folder = output_folder
        self.filename = filename
        self.tile_size=224
        
        #Some parameters for croping
        self.structure_fill=4
        self.structure_open=3
        self.structure_dilation=3
        self.structure_open2=1
        self.thumbnail_size = (224,224) #need to have the same size as tile size
        self.max_bg_frac = 0.5
        self.seg = True
        self.npdi = False
        self.SaveToFolder = os.path.join(self.output_folder, "preprocess") #preprocess tiling
        self.ShowIntermediateStates = False      
        self.tile_level_step_down = 1
        
        self.generate_slide()
        
        
            
    def generate_slide(self):
        """
        Generate deepzoom files
        """
        print(self.input_file)
        self.Slide = ops.OpenSlide(self.input_file)
        self.tiles = ops.deepzoom.DeepZoomGenerator(self.Slide, tile_size=self.tile_size, overlap=0, limit_bounds=False)
        assert (np.round(np.array(self.tiles.level_dimensions[-1]) / np.array(self.tiles.level_dimensions[-2])) == 2).all(), \
            'level_dimension[-2] should be almost twice smaller than level_dimension[-1] for proper conversion between 20x<->40x' #check of the conversion    

        
        self.max_lvl = self.tiles.level_count - self.tile_level_step_down

        previous = self.tiles.level_tiles[1]
        self.first_lvl = -1
        i = 2
        while self.first_lvl == -1 and i < self.max_lvl:
            if self.tiles.level_tiles[i] != previous:
                self.first_lvl = i - 1
            i += 1
        assert self.first_lvl != -1, "error with the size of zoom level"

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = []
            dzi_file = os.path.join(self.output_folder,"info.dzi") #dzi file
            write_info_to_file(self.input_file, dzi_file,self.tile_size)
            
            for current_lvl in range(self.first_lvl, self.max_lvl + 1):
                output_folder_tiles = os.path.join(self.output_folder, f"level_{current_lvl}", "data") #mandatory bc we need intermediary folder for model
                mkdir_if_not_exist(output_folder_tiles)
                if current_lvl == self.max_lvl:
                    #output_folder_tiles_atlas128 = os.path.join(self.output_folder, "atlas", "atlas128") #mandatory bc we need intermediary folder for model
                    #mkdir_if_not_exist(output_folder_tiles_atlas128)
                    #output_folder_tiles_atlas64 = os.path.join(self.output_folder, "atlas", "atlas64") #mandatory bc we need intermediary folder for model
                    #mkdir_if_not_exist(output_folder_tiles_atlas64)
                    output_model_tiles = os.path.join(self.output_folder, "model", "data") #mandatory bc we need intermediary folder for model
                    mkdir_if_not_exist(output_model_tiles)
                    self.inference_input = output_model_tiles
                    tile_count = self.tiles.level_tiles[self.max_lvl] 
                    self.segmentation, self.bg_th = self.CropSlideCoordRatios(tile_count[0],tile_count[1])
                    #future = executor.submit(save_tiles_for_max_lvl, self.input_file, output_model_tiles,output_folder_tiles_atlas64,output_folder_tiles_atlas128, self.filename, self.tile_size, current_lvl,self.segmentation, self.bg_th,self.max_bg_frac)
                    future = executor.submit(save_tiles_for_max_lvl, self.input_file, output_model_tiles, self.filename, self.tile_size, current_lvl,self.segmentation, self.bg_th,self.max_bg_frac)
                    futures.append(future)
                
                future = executor.submit(save_tiles_for_tiling, self.input_file, output_folder_tiles, self.filename, self.tile_size, current_lvl)
                futures.append(future)
                    

            concurrent.futures.wait(futures)
                

    
    def CropSlideCoordRatios(self,x_size,y_size):  # remove extra replicates and crop to image
        assert (self.SaveToFolder==None) or (type(self.SaveToFolder)==str), 'Proper save folder not provided.'
        if self.ShowIntermediateStates or (self.SaveToFolder!=None): 
            if self.ShowIntermediateStates:
                mpl.use('Agg')
            else:
                mpl.use('pdf')
        self.thumbnail_size = (x_size,y_size)

        thumb = np.asarray(self.Slide.get_thumbnail(self.thumbnail_size)) # create thumbnail (benefits: smaller, less computation and memory)
        imgray = 1-skc.rgb2gray(thumb) # convert to gray scale
        if self.seg == False:
            self.seg_final = np.full((imgray.shape[0], imgray.shape[1]), True)
            bg_thumb_min = 256
        else:
            regions, self.seg_filled, self.seg_filled_open, self.seg_filled_open_dilated, bg_imgray_mean, bg_imgray_std = self.segmentation_pip(imgray)
            imgray, flag = self.detect_remove_artefact_border(imgray, bg_imgray_mean, bg_imgray_std, 3, frac = 0.1)
            if flag == '_border_removed':
                while flag == '_border_removed': #Pourquoi réaliser une boucle ? Pourquoi on doit le faire plusieurs fois
                    regions, self.seg_filled, self.seg_filled_open, self.seg_filled_open_dilated, bg_imgray_mean, bg_imgray_std = self.segmentation_pip(imgray)
                    imgray, flag = self.detect_remove_artefact_border(imgray, bg_imgray_mean, bg_imgray_std, 3, frac = 0.1)
                flag = '_border_removed'

            self.seg_filled_open_dilated2, self.flag_seg_border_dil2 = self.remove_seg_border(self.seg_filled_open_dilated,imgray, bg_imgray_mean, bg_imgray_std, 3)
            imgray2 = np.ones(imgray.shape)*bg_imgray_mean
            imgray2 = np.where(self.seg_filled_open_dilated2 == True, imgray, imgray2)
            self.seg_triangle = imgray2 > threshold_triangle(imgray2)
            self.seg_triangle_open = binary_opening(self.seg_triangle, disk(self.structure_open2))
            self.seg_final, self.flag_seg_border_final = self.remove_seg_border(self.seg_triangle_open, imgray, bg_imgray_mean, bg_imgray_std, 3)
            thumb_final = np.dstack((thumb[:,:,0]*self.seg_final, thumb[:,:,1]*self.seg_final, thumb[:,:,2]*self.seg_final))
            bg_thumb_min = 255*(1-(bg_imgray_mean + 3*bg_imgray_std))
            if self.ShowIntermediateStates or (self.SaveToFolder!=None): 
                _,ax = pl.subplots(3,3,figsize = (15,11));pl.axis('off');
                TitleFontSize = 18
                fig = pl.sca(ax[0,0]);pl.imshow(thumb);pl.axis('off');pl.title('thumbnail',fontsize=TitleFontSize)
                pl.sca(ax[0,1]);pl.imshow(imgray,cmap='gray');pl.axis('off');pl.title(f'grayscale',fontsize=TitleFontSize)
                pl.sca(ax[0,2]);pl.imshow(regions,cmap='gray');pl.axis('off');pl.title('multiotsu',fontsize=TitleFontSize)   
                pl.sca(ax[1,0]);pl.imshow(self.seg_filled,cmap='gray');pl.axis('off');pl.title('fill the holes',fontsize=TitleFontSize)
                pl.sca(ax[1,1]);pl.imshow(self.seg_filled_open,cmap='gray');pl.axis('off');pl.title('morphologically open',fontsize=TitleFontSize)
                pl.sca(ax[1,2]);pl.imshow(self.seg_filled_open_dilated,cmap='gray');pl.axis('off');pl.title('morphologically dilated',fontsize=TitleFontSize)
                pl.sca(ax[2,0]);pl.imshow(self.seg_triangle,cmap='gray');pl.axis('off');pl.title('triangle',fontsize=TitleFontSize)
                pl.sca(ax[2,1]);pl.imshow(self.seg_triangle_open,cmap='gray');pl.axis('off');pl.title('morphologically open',fontsize=TitleFontSize)
                pl.sca(ax[2,2]);pl.imshow(thumb_final,cmap='gray');pl.axis('off');pl.title(f'final self.segmentation',fontsize=TitleFontSize)
                pl.axis('off');
                pl.tight_layout()
                if self.SaveToFolder!=None:
                    mkdir_if_not_exist(self.SaveToFolder)
                    pl.savefig(os.path.join(self.SaveToFolder,f'preprocess.jpg'), 
                               bbox_inches='tight', pad_inches=0)  
                    pl.close()
                    fig = pl.imshow(self.seg_final);pl.axis('off')
                    pl.savefig(os.path.join(self.SaveToFolder, 'binarized.png'), bbox_inches='tight', pad_inches=0)
                    pl.close()
        if self.SaveToFolder!=None:
            fig = pl.imshow(thumb);pl.axis('off')
            
            pl.savefig(os.path.join(self.SaveToFolder, 'slide.png'), bbox_inches='tight', pad_inches=0)
            pl.close()
            if ~self.ShowIntermediateStates:
                pl.close(pl.gcf())
        return self.seg_final, bg_thumb_min


    def segmentation_pip(self,imgray):
        thresholds = threshold_multiotsu(imgray) # threshold according to otsu's method
        regions = np.digitize(imgray, bins=thresholds)
        if self.npdi == True:
            print('ndpi True')
            regions = regions == 2
        self.seg_filled = binary_closing(regions, disk(self.structure_fill))
        self.seg_filled_open = binary_opening(self.seg_filled, disk(self.structure_open)) # morphologically open the image (remove small spots)
        self.seg_filled_open_dilated = binary_dilation(self.seg_filled_open, disk(self.structure_dilation)) 
        bg_imgray = imgray[np.where(self.seg_filled == False)]
        bg_imgray_mean = bg_imgray.mean()
        bg_imgray_std = bg_imgray.std()
        return regions, self.seg_filled, self.seg_filled_open, self.seg_filled_open_dilated, bg_imgray_mean, bg_imgray_std 


    def detect_remove_artefact_border(self,imgray, bg_imgray_mean, bg_imgray_std, constant_std, frac = 0.1):
        bg_limit = bg_imgray_mean + constant_std*bg_imgray_std
        arr_border_row_index = np.where(imgray[:,0] > bg_limit)[0] # line index of image with pixel values higher than bg mean value
        flag = ''
        if arr_border_row_index.size != 0:
            count = 0
            border_index_limit = list((math.ceil(imgray.shape[0]*frac), math.floor(imgray.shape[0]*(1-frac))))
            for border_row_index in arr_border_row_index:
                if border_row_index<=border_index_limit[0] or border_row_index>=border_index_limit[1]:
                    border_column_length = np.where(imgray[border_row_index,:] > bg_limit)[0]
                    if border_column_length.shape[0] >= imgray.shape[1]*(1-frac):
                        imgray[border_row_index,:] = bg_imgray_mean
                        count += 1
            if count != 0:
                flag = '_border_removed'
        return imgray, flag
    
    
    def remove_seg_border(self,segmentation, imgray, bg_imgray_mean, bg_imgray_std, constant_std):
        seg_copy = np.copy(segmentation)
        
        r_lim = seg_copy.shape[0]
        c_lim = seg_copy.shape[1]
        r, c = np.where(seg_copy == True)
        print(r,c)
        print(r.size,c.size)
        count = 0
        bg_limit = bg_imgray_mean + constant_std*bg_imgray_std
        for i in range(r.size):
            n=r[i]
            m=c[i]
            if n < r_lim-1 and m < c_lim-1:
                if is_on_edge(seg_copy, n,m) and imgray[n,m] <= bg_limit:
                    seg_copy[n,m] = False
                    count += 1
        if count == 0:
            flag_seg_border = ''
        else:
            if count == 1:
                flag_seg_border = f'(1_pixel_removed)'  
            else:
                flag_seg_border = f'({count}_pixels_removed)'
        return seg_copy, flag_seg_border
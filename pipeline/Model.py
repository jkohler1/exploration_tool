import torch
import sys
import torchvision
import cv2
import hdbscan
import timm
import clip
import numpy as np
import pandas as pd
from utils_pixplot import *
from specific_model.vit_small import vit_small
from torch.utils.data import DataLoader
from torchvision import datasets
from torchvision.datasets import ImageFolder
from torchvision.transforms import ToTensor
from torchvision import transforms
import umap.umap_ as umap
from sklearn.manifold import TSNE
import time

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

class ModelPixplot:

    def __init__(self, tiles_path, dimensionality_reduction, output, model_type, model_name, processing_unit,
                 batch_size, num_workers, tile_resize, tile_size, default_clustering):
        self.tiles_path = tiles_path
        self.dimensionality_reduction = dimensionality_reduction
        self.processing_unit = processing_unit
        self.batch_size = batch_size
        self.num_workers = num_workers
        self.tile_resize = tile_resize
        self.tile_size = tile_size
        self.output = output
        self.dico_avg_color = {}
        self.default_clustering = default_clustering
        sys.path.append('./specific_model')
        if self.tile_size == self.tile_resize:
            self.dataset = ImageFolderWithPaths(self.tiles_path, transform=ToTensor())
        else:
            self.dataset = ImageFolderWithPaths(self.tiles_path,
                                               transform=transforms.Compose([transforms.Resize(self.tile_resize),
                                                                             transforms.ToTensor()]))
        self.process_images_avg_color()
        for i in range(len(model_type)):
            mt = model_type[i]
            mn = model_name[i]
            output_model_name = os.path.join(self.output, mn)  # Output global path
            mkdir_if_not_exist(output_model_name)
            print('\n' + mn + ' Latent space computation has started.')
            start_time = time.time()
            model = self.load_model(mt, mn)  # load of the corresponding model
            self.apply_model(model, mt, mn, output_model_name)
            end_time = time.time()
            execution_time = end_time - start_time
            print(f"Model {mn} in {execution_time:.2f} seconds.")
            # Dimensionality reduction
            for dim in dimensionality_reduction:
                if dim == "umap":
                    start_time = time.time()
                    reduc_dim = self.reduce_dimensionality_umap(mt, mn, output_model_name)
                    end_time = time.time()
                    execution_time = end_time - start_time
                    print(f"UMAP in {execution_time:.2f} seconds.")
                    start_time = time.time()
                    self.generate_default_clustering(reduc_dim, output_model_name)
                    end_time = time.time()
                    execution_time = end_time - start_time
                    print(f"Default clustering in {execution_time:.2f} seconds.")
                elif dim == "tsne":
                    start_time = time.time()
                    reduc_dim = self.reduce_dimensionality_tsne(mt, mn, output_model_name)
                    end_time = time.time()
                    execution_time = end_time - start_time
                    print(f"t-SNE in {execution_time:.2f} seconds.")
                else:
                    print("Unknown dimensionality reduction method")

    def avg_color(self, image_path):
        # Load image with open CV
        img = cv2.imread(image_path)
        # Convert image in RGB
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        avg_color = np.mean(img_rgb, axis=(0, 1)).astype(int)
        return avg_color.tolist()  # Convertir en liste

    def process_images_avg_color(self):
        start_time = time.time()
        new_image_path = os.path.join(self.tiles_path, "data")
        for filename in os.listdir(new_image_path):
            if filename.endswith(".png"):  # Verifier si c'est un fichier png
                image_path = os.path.join(new_image_path, filename)
                avg_color = self.avg_color(image_path)
                self.dico_avg_color[filename] = avg_color
        end_time = time.time()
        execution_time = end_time - start_time
        print(f"avg_color calculated in {execution_time:.2f} seconds.")

    def generate_default_clustering(self, reduc_dim, output_clustering):
        # Remove col 'filename'
        reduc_dim_no_filename = reduc_dim.drop(columns=['filename'])
        reduc_dim_no_filename = reduc_dim_no_filename.drop(columns=['avg_color'])
        clusterer = hdbscan.HDBSCAN(min_cluster_size=200, gen_min_span_tree=True,
                                    cluster_selection_method='leaf')  # Using HDBSCAN
        labels = clusterer.fit_predict(reduc_dim_no_filename)
        points_clusters = pd.DataFrame({'umap_x': reduc_dim_no_filename['umap_x'],
                                        'umap_y': reduc_dim_no_filename['umap_y'], 'cluster': labels})
        points_clusters['filename'] = reduc_dim['filename']
        points_clusters['avg_color'] = reduc_dim['avg_color']
        points_clusters.to_csv(output_clustering + '/default_clusters.csv', index=False)

    def load_model(self, model_type, model_name):
        """Load model based on model_type, model_name, and processing_unit"""
        print(model_type)
        if model_type == "timm":
            model = timm.create_model(model_name, pretrained=True, num_classes=0)
        elif model_type == "dino":
            print(model_name)
            model = torch.hub.load('facebookresearch/dino:main', f'dino_{model_name}')
        elif model_type == "dino2":
            model = torch.hub.load('facebookresearch/dinov2', f'dinov2_{model_name}')
        elif model_type == "lunit_dino_model":
            model = vit_small(self.tile_size, pretrained=True, progress=False, key="DINO_p16", patch_size=16)
        elif model_type == "clip":
            model, preprocess = clip.load(model_name)
        elif model_type == "resnet18":
            raise NotImplementedError("Not implemented yet")
        else:
            raise NameError("Model name not recognized.")
        if self.processing_unit != "cpu":
            torch.cuda.empty_cache()
            print("GPU are used")
            self.cuda_unit = torch.device(self.processing_unit)
            model = model.cuda(self.cuda_unit)
            model.eval()
        return model

    def apply_model(self, model, model_type, model_name, output_model_name):
        dataload = DataLoader(self.dataset, batch_size=self.batch_size, num_workers=self.num_workers, shuffle=False)
        for i, (images, labels, paths) in enumerate(dataload):
            if self.processing_unit != "cpu":
                images = images.cuda(self.cuda_unit)
            if model_name in ['RN50', 'RN101', 'RN50x4', 'RN50x16', 'RN50x64', 'ViT-B/32', 'ViT-B/16', 'ViT-L/14',
                              'ViT-L/14@336px']:
                with torch.no_grad():
                    repLat = model.encode_image(images).float()
            else:
                repLat = model(images)
            array = repLat.detach().cpu().numpy()
            torch.cuda.empty_cache()
            df = pd.DataFrame(array)

            paths_basename = basename_tuple(paths[0:(self.batch_size + 1)])
            df.insert(0, "tile_name", paths_basename)
            df.insert(1, "image_name", model_name)

            if i == 0:
                data = df
            else:
                data = pd.concat([data, df])
        print("latent_space_dimension: ", data.shape)
        data.index = data['tile_name']
        data = data.drop(['tile_name'], axis=1)

        data.to_csv(output_model_name + "/repLat" + model_name + ".csv", header=False)
        print("end inference")

    def reduce_dimensionality_umap(self, model_type, model_name, output_model_name):
        latent_space_file = output_model_name + "/repLat" + model_name + ".csv"
        latent = pd.read_csv(latent_space_file, header=None, index_col=0)
        latent = latent.drop(columns=[1])

        # Make and plot UMAP
        reducer = umap.UMAP()
        embedding = reducer.fit_transform(latent)
        umap_data = pd.DataFrame({'filename': latent.index, 'umap_x': embedding[:, 0], 'umap_y': embedding[:, 1]})
        ret_data = umap_data
        umap_data['avg_color'] = umap_data['filename'].map(self.dico_avg_color)
        umap_data.to_csv(output_model_name + "/umap_data.csv", index=False)
        return ret_data

    def reduce_dimensionality_tsne(self, model_type, model_name, output_model_name):
        latent_space_file = output_model_name + "/repLat" + model_name + ".csv"
        latent = pd.read_csv(latent_space_file, header=None, index_col=0)
        latent = latent.drop(columns=[1])

        # Make and plot t-SNE
        reducer = TSNE(n_components=2, random_state=42)
        embedding = reducer.fit_transform(latent)

        tsne_data = pd.DataFrame({'filename': latent.index, 'umap_x': embedding[:, 0], 'umap_y': embedding[:, 1]})
        ret_data = tsne_data
        tsne_data['avg_color'] = tsne_data['filename'].map(self.dico_avg_color)
        tsne_data.to_csv(output_model_name + "/tsne_data.csv", index=False)
        return ret_data

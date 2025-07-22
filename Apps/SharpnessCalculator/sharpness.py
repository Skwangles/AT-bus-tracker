import os
import json
import numpy as np
from PIL import Image, ImageFilter
import concurrent.futures

def calculate_sharpness(image_path):
    """
    Calculate the sharpness of an image using the variance of the Laplacian (edge intensity).
    Args:
        image_path (str): Path to the image file.
    Returns:
        tuple: (image_path, sharpness value or None if error)
    """
    try:
        print("Processing: ", image_path)
        with Image.open(image_path) as img:
            grayscale_img = img.convert("L")
            laplacian = grayscale_img.filter(ImageFilter.FIND_EDGES)
            laplacian_array = np.array(laplacian)
            sharpness = laplacian_array.var()
        return (image_path, sharpness)
    except Exception as e:
        return (image_path, None)

def process_images(directory):
    """
    Process all images in a directory and calculate their sharpness.
    Args:
        directory (str): Directory containing image files.
    Returns:
        dict: Mapping from image filename to sharpness value or 'Error'.
    """
    image_files = [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith(("png", "jpg", "jpeg", "bmp", "gif"))
    ]
    sharpness_results = {}
    with concurrent.futures.ThreadPoolExecutor() as executor:
        print("Starting sharpness calculation on:", len(image_files))
        results = executor.map(calculate_sharpness, image_files)
        for image_path, sharpness in list(results):
            if sharpness is not None:
                sharpness_results[os.path.basename(image_path)] = sharpness
            else:
                sharpness_results[os.path.basename(image_path)] = "Error"
    print("Finished")
    return sharpness_results

def save_sharpness_results(results, output_file):
    """
    Save the sharpness results to a JSON file.
    Args:
        results (dict): Mapping from image filename to sharpness value or 'Error'.
        output_file (str): Path to output JSON file.
    """
    if os.path.isfile(output_file):
        os.remove(output_file)
    with open(output_file, "w") as f:
        json.dump(results, f, indent=4)

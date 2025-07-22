import os
import cv2
import numpy as np
import json
from typing import List, Dict

def compute_global_histogram_and_cdf(image_files: List[str]) -> Dict[str, object]:
    """
    Compute the average histogram and cumulative distribution function (CDF) for a list of images.
    Args:
        image_files (List[str]): List of image file paths.
    Returns:
        Dict[str, object]: Dictionary containing normalised histogram, CDF, and number of images.
    """
    hist_sum = np.zeros(256)
    valid_images = 0
    for i, path in enumerate(image_files):
        print(f"Processing image {i + 1} of {len(image_files)}")
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is not None:
            hist = cv2.calcHist([img], [0], None, [256], [0, 256])
            hist_sum += hist.flatten()
            valid_images += 1
    if valid_images == 0:
        raise ValueError("No valid images found for histogram calculation.")
    avg_hist = hist_sum / valid_images
    avg_hist_norm = (avg_hist / avg_hist.sum()).tolist()
    cdf = np.cumsum(avg_hist)
    cdf_norm = (cdf / cdf[-1]).tolist()
    return {
        "histogram": avg_hist_norm,
        "cdf": cdf_norm,
        "num_images": valid_images
    }

def export_histogram_json(hist_data: Dict[str, object], output_file: str) -> None:
    """
    Export the histogram and CDF data to a JSON file.
    Args:
        hist_data (Dict[str, object]): Histogram and CDF data.
        output_file (str): Path to output JSON file.
    """
    if os.path.isfile(output_file):
        os.remove(output_file)
    with open(output_file, "w") as f:
        json.dump(hist_data, f, indent=4) 
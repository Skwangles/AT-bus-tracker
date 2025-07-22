import os
import cv2
import numpy as np
import json
from typing import List, Dict
import concurrent.futures
import threading

def _compute_histogram(image_path: str, counter: threading.Lock, progress: dict, total: int) -> np.ndarray:
    """
    Compute the histogram for a single image file and print progress.
    Args:
        image_path (str): Path to the image file.
        counter (threading.Lock): Lock for thread-safe progress update.
        progress (dict): Dictionary holding the current count.
        total (int): Total number of images.
    Returns:
        np.ndarray: Histogram array of length 256, or None if image is invalid.
    """
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    with counter:
        progress['count'] += 1
        print(f"Processed {progress['count']} of {total} images")
    if img is not None:
        hist = cv2.calcHist([img], [0], None, [256], [0, 256])
        return hist.flatten()
    return None

def compute_global_histogram_and_cdf(image_files: List[str]) -> Dict[str, object]:
    """
    Compute the average histogram and cumulative distribution function (CDF) for a list of images, in parallel, with progress logging.
    Args:
        image_files (List[str]): List of image file paths.
    Returns:
        Dict[str, object]: Dictionary containing normalised histogram, CDF, and number of images.
    """
    hist_sum = np.zeros(256)
    valid_images = 0
    total = len(image_files)
    counter = threading.Lock()
    progress = {'count': 0}
    # Use ThreadPoolExecutor for parallel histogram computation with progress
    with concurrent.futures.ThreadPoolExecutor() as executor:
        results = list(executor.map(lambda path: _compute_histogram(path, counter, progress, total), image_files))
    for hist in results:
        if hist is not None:
            hist_sum += hist
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
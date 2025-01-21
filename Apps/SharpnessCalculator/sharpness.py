import os
import json
import argparse
import numpy as np
from PIL import Image, ImageFilter
import concurrent.futures


# Function to calculate the sharpness of an image
def calculate_sharpness(image_path):
    try:
        print("Processing: ", image_path)
        # Open the image file
        with Image.open(image_path) as img:
            # Convert to grayscale
            grayscale_img = img.convert("L")
            # Apply a Laplacian filter to get edge intensity
            laplacian = grayscale_img.filter(ImageFilter.FIND_EDGES)
            # Convert to numpy array to calculate variance (sharpness)
            laplacian_array = np.array(laplacian)
            sharpness = laplacian_array.var()
        return (image_path, sharpness)
    except Exception as e:
        # In case of any error (e.g., corrupt image), return a default value
        return (image_path, None)


# Function to process a directory and calculate sharpness for all images
def process_images(directory):
    # Get all image files in the directory
    image_files = [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith(("png", "jpg", "jpeg", "bmp", "gif"))
    ]

    # Use ThreadPoolExecutor for parallel processing
    sharpness_results = {}
    with concurrent.futures.ThreadPoolExecutor() as executor:
        # Map the function to all image files
        print("Starting sharpness calculation on:", len(image_files))
        results = executor.map(calculate_sharpness, image_files)
        # Collect results into a dictionary
        for image_path, sharpness in results:
            if sharpness is not None:
                sharpness_results[os.path.basename(image_path)] = sharpness
            else:
                sharpness_results[os.path.basename(image_path)] = "Error"
    print("Finished")
    return sharpness_results


# Save the sharpness results to a JSON file
def save_sharpness_results(results, output_file):
    with open(output_file, "w") as f:
        json.dump(results, f, indent=4)


# Main function to parse arguments and run the program
def main():
    # Set up argument parsing
    parser = argparse.ArgumentParser(
        description="Calculate the sharpness of images in a directory."
    )
    parser.add_argument(
        "search_directory", type=str, help="Directory to search for image files"
    )
    parser.add_argument(
        "output_file",
        type=str,
        help="Output file path to save the results in JSON format",
    )

    # Parse arguments
    args = parser.parse_args()

    # Process images and calculate sharpness
    sharpness_results = process_images(args.search_directory)

    # Save the results to the specified output file
    save_sharpness_results(sharpness_results, args.output_file)
    print(f"Sharpness values saved to {args.output_file}")


if __name__ == "__main__":
    main()

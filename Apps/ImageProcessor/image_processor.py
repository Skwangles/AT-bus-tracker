import os
import cv2
import boto3
import numpy as np
from dotenv import load_dotenv
from pathlib import Path
import sqlite3
import subprocess
import io
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load environment variables from .env file
load_dotenv()

R2_ENDPOINT = os.getenv('CV_R2_ENDPOINT')
R2_BUCKET = os.getenv('CV_R2_BUCKET')
R2_ACCESS_KEY_ID = os.getenv('CV_R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('CV_R2_SECRET_ACCESS_KEY')
R2_REGION = os.getenv('CV_R2_REGION', 'auto')

# Resolution levels for image processing
RESOLUTION_LEVELS = {
    'preview': {'resolution': {'width': 480, 'height': 240}, 'extension': 'jpg', 'quality': 70},
    'low': {'resolution': {'width': 1920, 'height': 960}, 'extension': 'jpg', 'quality': 80},
    'high': {'resolution': {'width': 3840, 'height': 1920}, 'extension': 'png', 'quality': 100},
    'ultra': {'resolution': {'width': 5760, 'height': 2880}, 'extension': 'png', 'quality': 100},
}

# Set up boto3 S3 client for R2
s3 = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name=R2_REGION,
)



def create_resized_image(image_path: str, dimensions: dict, extension: str, quality: int) -> bytes:
    """
    Create a resized version of an image using PIL.
    """
    with Image.open(image_path) as img:
        resized_img = img.resize((dimensions['width'], dimensions['height']), Image.Resampling.BILINEAR)
        
        # Determine format based on extension
        if extension == 'jpg':
            format_type = 'JPEG'
            # Convert to RGB if necessary for JPEG
            if resized_img.mode in ('RGBA', 'LA', 'P'):
                resized_img = resized_img.convert('RGB')
        else:  # png
            format_type = 'PNG'
        
        # Save to bytes
        output = io.BytesIO()
        if format_type == 'JPEG':
            resized_img.save(output, format='JPEG', quality=quality, optimize=True)
        else:  # PNG
            resized_img.save(output, format='PNG', optimize=True)
        
        return output.getvalue()

def blur_image(input_file: Path, blurred_file: Path) -> bool:
    """
    Blur faces in an equirectangular image.
    Returns True if successful, False otherwise.
    """
    try:
        print(f"Blurring {input_file} -> {blurred_file}")
        models_dir = os.getenv('BLUR360_MODELS_DIR', '/usr/local/share/blur360/models')
        cmd = [
            '/home/skwangles/Documents/Honours/FaceBlurring/blur360/build/src/equirect-blur-image',
            f'-m={models_dir}',
            '-b',
            f'-o={blurred_file}',
            str(input_file)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"Blurring {input_file} -> {blurred_file} Result: {result.returncode}")
        if result.stderr:
            print(f"Warnings from blur command for {input_file}: {result.stderr}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running blur command for {input_file}: {e.stderr}")
        return False

def upload_image_resolutions(local_path: str, ts: str):
    """
    Upload multiple resolution versions of an image to R2.
    """
    print(f"AWS config: {R2_ENDPOINT}, {R2_BUCKET}, {R2_ACCESS_KEY_ID}, {R2_SECRET_ACCESS_KEY}, {R2_REGION}")
    for resolution_name, settings in RESOLUTION_LEVELS.items():
        remote_key = f"{ts}-{resolution_name}.{settings['extension']}"
        print(f"Uploading {local_path} to {remote_key}")
        # Check if file already exists
        try:
            s3.head_object(Bucket=R2_BUCKET, Key=remote_key)
            print(f"File {remote_key} already exists in R2, skipping upload")
            continue
        except s3.exceptions.ClientError as e:
            if e.response['Error']['Code'] != '404':
                print(f"Error checking R2: {e}")
                continue
        
        # Create resized image and upload
        try:
            resized_buffer = create_resized_image(
                local_path, 
                settings['resolution'], 
                settings['extension'], 
                settings['quality']
            )
            s3.upload_fileobj(io.BytesIO(resized_buffer), R2_BUCKET, remote_key)
            print(f"Uploaded {remote_key} to R2")
        except Exception as e:
            print(f"Error uploading {remote_key}: {e}")


def process_from_db(db_path: str, input_dir: str, output_dir: str):
    """
    For each ts in the db, round to 5dp, add .png, process image: equalise histogram, blur faces (equirect), upload to R2 if not already present.
    Processes blurring operations in batches of 8 concurrent operations.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    table_name = f"nodes"
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    try:
        cursor.execute(f"SELECT ts FROM {table_name}")
        rows = cursor.fetchall()

        print(f"Processing {len(rows)} images")
        
        # Collect all images that need blurring
        images_to_blur = []
        images_to_upload = []
        
        for (ts_raw,) in rows:
            ts = f"{float(ts_raw):.5f}"
            filename = f"{ts}.png"
            input_file = Path(input_dir) / filename
            if not input_file.exists():
                print(f"File not found: {input_file}")
                continue
            
            blurred_file = output_path / f"{ts}_blurred.png"
            if blurred_file.exists():
                print(f"Blurred file exists: {blurred_file}")
                images_to_upload.append((ts, blurred_file))
            else:
                images_to_blur.append((ts, input_file, blurred_file))
        
        # Process blurring in batches of 8
        batch_size = 8
        print(f"Blurring {len(images_to_blur)} images in batches of {batch_size}")
        
        with ThreadPoolExecutor(max_workers=batch_size) as executor:
            # Submit all blur tasks
            future_to_image = {
                executor.submit(blur_image, input_file, blurred_file): (ts, input_file, blurred_file)
                for ts, input_file, blurred_file in images_to_blur
            }
            
            # Process completed tasks
            completed = 0
            for future in as_completed(future_to_image):
                ts, input_file, blurred_file = future_to_image[future]
                completed += 1
                try:
                    success = future.result()
                    if success:
                        print(f"Completed blurring {completed}/{len(images_to_blur)}: {input_file} -> {blurred_file}")
                        images_to_upload.append((ts, blurred_file))
                    else:
                        print(f"Failed to blur {input_file}")
                except Exception as e:
                    print(f"Exception while blurring {input_file}: {e}")
        
        # Upload all processed images
        print(f"Uploading {len(images_to_upload)} images to R2")
        for ts, blurred_file in images_to_upload:
            print(f"Uploading multiple resolutions for {ts}")
            upload_image_resolutions(str(blurred_file), ts)
            
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Process images: blur faces, equalise histogram, upload to R2, or copy from DB list.')
    subparsers = parser.add_subparsers(dest='mode', required=True)

    folder_parser = subparsers.add_parser('folder', help='Process all images in a folder')
    folder_parser.add_argument('input_folder', help='Path to input folder with images')
    folder_parser.add_argument('output_folder', help='Path to output folder for processed images')

    db_parser = subparsers.add_parser('db', help='Process images listed in a SQLite3 db nodes table')
    db_parser.add_argument('db_path', help='Path to SQLite3 database')
    db_parser.add_argument('input_dir', help='Directory containing input images')
    db_parser.add_argument('output_dir', help='Directory for processed images')

    args = parser.parse_args()
    process_from_db(args.db_path, args.input_dir, args.output_dir)

import argparse
import os
from sharpness import process_images, save_sharpness_results
from histogram import compute_global_histogram_and_cdf, export_histogram_json

def main():
    parser = argparse.ArgumentParser(description="Image analysis utility: calculate sharpness or export global histogram/CDF.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Sharpness calculation subcommand
    parser_sharp = subparsers.add_parser("sharpness", help="Calculate image sharpness for a directory.")
    parser_sharp.add_argument("search_directory", type=str, help="Directory to search for image files.")
    parser_sharp.add_argument("output_file", type=str, help="Output file path to save the results in JSON format.")

    # Histogram export subcommand
    parser_hist = subparsers.add_parser("histogram", help="Export global histogram and CDF for a directory of images.")
    parser_hist.add_argument("search_directory", type=str, help="Directory to search for image files.")
    parser_hist.add_argument("output_file", type=str, help="Output file path to save the histogram/CDF in JSON format.")

    args = parser.parse_args()

    if args.command == "sharpness":
        if not os.path.isdir(args.search_directory):
            print("Image directory does not exist.")
            return
        if os.path.isfile(args.output_file):
            user_in = input("Output file already exists - recompute?: (y/N)")
            if (user_in != 'y' and user_in != 'Y'):
                return
        sharpness_results = process_images(args.search_directory)
        save_sharpness_results(sharpness_results, args.output_file)
        print(f"Sharpness values saved to {args.output_file}")

    elif args.command == "histogram":
        if not os.path.isdir(args.search_directory):
            print("Image directory does not exist.")
            return
        image_files = [
            os.path.join(args.search_directory, f)
            for f in os.listdir(args.search_directory)
            if f.lower().endswith(("png", "jpg", "jpeg", "bmp", "gif"))
        ]
        hist_data = compute_global_histogram_and_cdf(image_files)
        export_histogram_json(hist_data, args.output_file)
        print(f"Exported global histogram/CDF to {args.output_file}")

if __name__ == "__main__":
    main() 
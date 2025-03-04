import * as fs from 'fs';
import * as path from 'path';
import * as cv from '@u4/opencv4nodejs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Detects and blurs faces in an equirectangular 360° image
 * 
 * @param inputPath - Path to the input equirectangular image
 * @param outputPath - Path where the processed image will be saved
 * @returns Promise that resolves when the processing is complete
 */
async function blurFacesInEquirectangular(inputPath: string, outputPath: string): Promise<void> {
  try {
    console.log("Reading image");
    // Verify the input image can be read
    const image = cv.imread(inputPath);
    if (!image) {
      throw new Error(`Failed to load image from ${inputPath}`);
    }

    console.log("Checking output dir");
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Call the blur360 equirect-blur-image executable
    console.log("Running face detection and blurring");

    // Get the models dir path - default is /usr/local/share/blur360/models
    // You might need to adjust this based on where the models are installed
    const modelsDir = process.env.BLUR360_MODELS_DIR || '/usr/local/share/blur360/models';

    try {
      const { stdout, stderr } = await execAsync(
        `equirect-blur-image -m=${modelsDir} -b -o=${outputPath} ${inputPath}`
      );

      console.log("Face blurring complete");
      if (stderr) {
        console.warn("Process warnings:", stderr);
      }
    } catch (error: any) {
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }
  catch (e) {
    console.error("Error processing image:", e);
    throw e;
  }
}

export default blurFacesInEquirectangular;
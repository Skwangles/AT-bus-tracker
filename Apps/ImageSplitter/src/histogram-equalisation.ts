import fs from 'fs'
import sharp from 'sharp'

interface HistogramData {
  histogram: number[]
  cdf: number[]
  num_images: number
}

/**
 * Read and parse the histogram JSON file containing global histogram and CDF data.
 * @param histogramJsonPath - Path to the histogram.json file
 * @returns Parsed histogram data or null if file doesn't exist
 */
export function readHistogramData(histogramJsonPath: string): HistogramData | null {
  try {
    if (!fs.existsSync(histogramJsonPath)) {
      console.log(`Histogram file not found at ${histogramJsonPath}, skipping histogram equalisation`)
      return null
    }
    
    const data = fs.readFileSync(histogramJsonPath, 'utf8')
    const histogramData: HistogramData = JSON.parse(data)
    
    if (!histogramData.cdf || !Array.isArray(histogramData.cdf) || histogramData.cdf.length !== 256) {
      console.error('Invalid histogram data: CDF must be an array of 256 values')
      return null
    }
    
    console.log(`Loaded histogram data for ${histogramData.num_images} images`)
    return histogramData
  } catch (error) {
    console.error('Error reading histogram data:', error)
    return null
  }
}

/**
 * Apply histogram equalisation to an image using the global CDF.
 * @param inputImagePath - Path to the input image
 * @param outputImagePath - Path for the output equalised image
 * @param globalCdf - Global cumulative distribution function (256 values)
 * @returns Promise that resolves when equalisation is complete
 */
export async function applyHistogramEqualisation(
  inputImagePath: string, 
  outputImagePath: string, 
  globalCdf: number[]
): Promise<void> {
  try {
    // Read the image and get its histogram
    const image = sharp(inputImagePath)
    const metadata = await image.metadata()
    
    // Convert to grayscale for histogram calculation
    const grayscaleBuffer = await image.grayscale().raw().toBuffer()
    
    // Calculate the image's histogram
    const histogram = new Array(256).fill(0)
    for (let i = 0; i < grayscaleBuffer.length; i++) {
      histogram[grayscaleBuffer[i]]++
    }
    
    // Calculate the image's CDF
    const imageCdf = new Array(256).fill(0)
    let sum = 0
    for (let i = 0; i < 256; i++) {
      sum += histogram[i]
      imageCdf[i] = sum / grayscaleBuffer.length
    }
    
    // Create lookup table for histogram matching
    const lookupTable = new Array(256).fill(0)
    for (let i = 0; i < 256; i++) {
      // Find the closest value in global CDF
      let minDiff = Infinity
      let bestMatch = 0
      for (let j = 0; j < 256; j++) {
        const diff = Math.abs(imageCdf[i] - globalCdf[j])
        if (diff < minDiff) {
          minDiff = diff
          bestMatch = j
        }
      }
      lookupTable[i] = bestMatch
    }
    
    // Apply the lookup table to equalise the image
    const equalisedBuffer = Buffer.alloc(grayscaleBuffer.length)
    for (let i = 0; i < grayscaleBuffer.length; i++) {
      equalisedBuffer[i] = lookupTable[grayscaleBuffer[i]]
    }
    
    // Convert back to the original format and save
    await sharp(equalisedBuffer, {
      raw: {
        width: metadata.width!,
        height: metadata.height!,
        channels: 1
      }
    })
    .png()
    .toFile(outputImagePath)
    
    console.log(`Applied histogram equalisation to ${inputImagePath}`)
  } catch (error) {
    console.error(`Error applying histogram equalisation to ${inputImagePath}:`, error)
    throw error
  }
}

/**
 * Process an image with optional histogram equalisation.
 * @param inputImagePath - Path to the input image
 * @param outputImagePath - Path for the output image
 * @param histogramData - Histogram data for equalisation (optional)
 * @returns Promise that resolves when processing is complete
 */
export async function processImageWithHistogramEqualisation(
  inputImagePath: string,
  outputImagePath: string,
  histogramData: HistogramData | null
): Promise<void> {
  if (histogramData) {
    // Apply histogram equalisation
    await applyHistogramEqualisation(inputImagePath, outputImagePath, histogramData.cdf)
  } else {
    // Just copy the file without equalisation
    await fs.promises.copyFile(inputImagePath, outputImagePath)
  }
} 
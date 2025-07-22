import path from 'path'
import dotenv from 'dotenv'
import fs from 'fs'
import { DFLT_BATCH_SIZE, DFLT_FACE_BLUR, DFLT_IMG_EXT, DFLT_INPUT_DIR, DFLT_OUTPUT_DIR, DFLT_SQLITE_DB_PATH, DFLT_TABLE_PREFIX, DFLT_TS_DP, DFLT_R2_ENDPOINT, DFLT_R2_BUCKET, DFLT_R2_REGION, DFLT_HISTOGRAM_JSON_PATH } from './consts';
import { closeDb, initDB, readDB } from './db';
import { R2Client, R2Config } from './r2-client';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import blurFacesInEquirectangular from './blur-faces';
import { readHistogramData, processImageWithHistogramEqualisation } from './histogram-equalisation';

dotenv.config()

const args: any = yargs(hideBin(process.argv)).argv

if (args.h) {
  console.log(args)
  console.log(`
      Args and their defaults:
      --db=${DFLT_SQLITE_DB_PATH}
      --input_dir=${DFLT_INPUT_DIR}
      --output_dir=${DFLT_OUTPUT_DIR}
      --batch=${DFLT_BATCH_SIZE}
      --img_ext=${DFLT_IMG_EXT}
      --dp=${DFLT_TS_DP}
      --prefix=${DFLT_TABLE_PREFIX}
      --blur=${DFLT_FACE_BLUR}
      --histogram_json=${DFLT_HISTOGRAM_JSON_PATH}
      
      R2 Configuration:
      --use_r2=false
      --r2_endpoint=${DFLT_R2_ENDPOINT}
      --r2_bucket=${DFLT_R2_BUCKET}
      --r2_region=${DFLT_R2_REGION}
      --r2_access_key_id=your-access-key-id
      --r2_secret_access_key=your-secret-access-key
      `)
  process.exit(0)
}

const sqlite_db_path = args.db ?? (process.env.CV_EXTRACT_IN_DB_NAME && process.env.CV_DB_DIR ? path.join(process.env.CV_DB_DIR, process.env.CV_EXTRACT_IN_DB_NAME) : DFLT_SQLITE_DB_PATH)
const table_prefix = args.prefix ?? process.env.CV_EXTRACT_TABLE_PREFIX ?? DFLT_TABLE_PREFIX
const input_pic_dir = args.input_dir ?? process.env.CV_KEYFRAME_IMG_DIR ?? DFLT_INPUT_DIR
const output_pic_dir = args.output_dir ?? process.env.CV_EXTRACT_USED_IMAGES_DIR ?? DFLT_OUTPUT_DIR
const img_ext = args.img_ext ?? process.env.CV_KEYFRAME_IMG_EXTENSION ?? DFLT_IMG_EXT
const batch_size = Number(args.batch ?? process.env.CV_EXTRACT_BATCH_SIZE ?? DFLT_BATCH_SIZE)
const ts_dp = Number(args.dp ?? process.env.CV_KEYFRAME_IMG_NAME_DP ?? DFLT_TS_DP)
const blur = args.blur ?? process.env.CV_EXTRACT_FACE_BLUR ? process.env.CV_EXTRACT_FACE_BLUR == 'true' : DFLT_FACE_BLUR
const histogram_json_path = args.histogram_json ?? process.env.CV_PRECALCULATE_HISTOGRAM_JSON_PATH ?? DFLT_HISTOGRAM_JSON_PATH

// R2 Configuration
const useR2 = args.use_r2 ?? process.env.CV_USE_R2 === 'true' ?? false
const r2Endpoint = args.r2_endpoint ?? process.env.CV_R2_ENDPOINT ?? DFLT_R2_ENDPOINT
const r2Bucket = args.r2_bucket ?? process.env.CV_R2_BUCKET ?? DFLT_R2_BUCKET
const r2Region = args.r2_region ?? process.env.CV_R2_REGION ?? DFLT_R2_REGION
const r2AccessKeyId = args.r2_access_key_id ?? process.env.CV_R2_ACCESS_KEY_ID
const r2SecretAccessKey = args.r2_secret_access_key ?? process.env.CV_R2_SECRET_ACCESS_KEY

console.info("Using Args: DB:", sqlite_db_path, '\nInput:', input_pic_dir, '\nOutput:', output_pic_dir, '\nImg Extension:', img_ext, '\nTable Prefix:', table_prefix, '\nBatch size:', batch_size, '\nHistogram JSON:', histogram_json_path, '\nUse R2:', useR2, '\nR2 Endpoint:', r2Endpoint, '\nR2 Bucket:', r2Bucket, '\nR2 Region:', r2Region, '\nR2 Access Key ID:', r2AccessKeyId)

// Read histogram data for equalisation
const histogramData = readHistogramData(histogram_json_path)

// Initialize R2 client if enabled
let r2Client: R2Client | null = null
if (useR2) {
  console.info("Using R2")
  if (!r2AccessKeyId || !r2SecretAccessKey) {
    console.error("R2 is enabled but access key ID and secret access key are required")
    process.exit(1)
  }
  
  const r2Config: R2Config = {
    endpoint: r2Endpoint,
    bucket: r2Bucket,
    region: r2Region,
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  }
  
  r2Client = new R2Client(r2Config)
  console.info("R2 client initialized with endpoint:", r2Endpoint, "bucket:", r2Bucket)
}

const processHasCompletedFileFilePath = useR2 ? "complete.txt" : path.join(output_pic_dir, "complete.txt")

async function copyFileIfExists(file: string | number, input_pic_dir: string, output_pic_dir: string, img_ext: string) {
  const filePath = path.join(input_pic_dir, Number(file).toFixed(ts_dp) + img_ext);
  const outputPath = path.join(output_pic_dir, Number(file).toFixed(ts_dp) + img_ext);
  console.log(filePath, "to", outputPath);
  if (fs.existsSync(filePath) && !fs.existsSync(outputPath)) {  
    await fs.promises.copyFile(filePath, outputPath);
  }
}

async function processImages() {
  const time = new Date();
  console.log("Starting on:", time.toLocaleTimeString())
  const rows: { ts: string | number }[] = await readDB(`SELECT ts FROM ${table_prefix}nodes`);

  for (let i = 0; i < rows.length; i += batch_size) {
    const batch = rows.slice(i, i + batch_size);

    await Promise.all(batch.map(async (row) => {
      const inputImagePath = path.join(input_pic_dir, Number(row.ts).toFixed(ts_dp) + img_ext);
      console.log("Parsing ", inputImagePath)

      if (fs.existsSync(inputImagePath)) {
        console.log("File exists - blurring: ", blur, "histogram equalisation:", !!histogramData)
        
        if (useR2 && r2Client) {
          // Upload to R2
          if (blur || histogramData) {
            // Create temporary file for processed image
            const uploadPath = path.join(output_pic_dir, Number(row.ts).toFixed(ts_dp) + img_ext);
            const tempOutputPath = path.join(output_pic_dir, Number(row.ts).toFixed(ts_dp) + "-histo" + img_ext);
            
            if (histogramData) {
              await processImageWithHistogramEqualisation(inputImagePath, tempOutputPath, histogramData);
            }

            if (blur) {
              await blurFacesInEquirectangular(histogramData ? tempOutputPath : inputImagePath, uploadPath);
            } else {
              await processImageWithHistogramEqualisation(histogramData ? tempOutputPath : inputImagePath, uploadPath, histogramData);
            }
            
            await r2Client.uploadImageResolutions(uploadPath, Number(row.ts).toFixed(ts_dp), img_ext);
            // Clean up temporary file
            fs.unlinkSync(uploadPath);
          } else {
            await r2Client.uploadImageResolutions(inputImagePath, Number(row.ts).toFixed(ts_dp), img_ext);
          }
        } else {
          // Local file operations
          const outputImagePath = path.join(output_pic_dir, Number(row.ts).toFixed(ts_dp) + img_ext);
          if (blur || histogramData) {
            const tempOutputPath = path.join(output_pic_dir, Number(row.ts).toFixed(ts_dp) + "-histo" + img_ext);
            if (histogramData) {
              await processImageWithHistogramEqualisation(inputImagePath, tempOutputPath, histogramData);
            }
            if (blur) {
              await blurFacesInEquirectangular(histogramData ? tempOutputPath : inputImagePath, outputImagePath);
            } else {
              await copyFileIfExists(histogramData ? tempOutputPath : inputImagePath, input_pic_dir, output_pic_dir, img_ext);
            }
          }
        }
      }
      else {
        console.error("File doesn't exist")
      }
    }));
  }
  
  const completionMessage = "Completed run started at:" + time.toLocaleTimeString() + " and ended at:" + new Date().toLocaleTimeString()
  if (useR2 && r2Client) {
    // Upload completion file to R2
    const tempCompletionFile = "complete.txt"
    fs.writeFileSync(tempCompletionFile, completionMessage)
    await r2Client.uploadFileIfNotExists(tempCompletionFile, "complete.txt")
    fs.unlinkSync(tempCompletionFile)
  } else {
    fs.writeFileSync(processHasCompletedFileFilePath, completionMessage)
  }
}

// If the process is being rerun, we don't want the user confused whether this is a new run completed or the old one stuck around
async function checkAndCleanupCompletionFile() {
  if (useR2 && r2Client) {
    // For R2, we'll check if completion file exists and delete it if it does
    try {
      const exists = await r2Client.fileExists("complete.txt")
      if (exists) {
        console.log("Previous completion file found in R2, starting fresh run")
      }
    } catch (error) {
      console.log("No previous completion file found in R2")
    }
  } else if (fs.existsSync(processHasCompletedFileFilePath)) {
    fs.rmSync(processHasCompletedFileFilePath)
  }
}

console.info("Init DB")
initDB(sqlite_db_path)
checkAndCleanupCompletionFile().then(() => {
  processImages().then(closeDb).catch(console.error);
}).catch(console.error);

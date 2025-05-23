import path from 'path'
import dotenv from 'dotenv'
import fs from 'fs'
import { DFLT_BATCH_SIZE, DFLT_FACE_BLUR, DFLT_IMG_EXT, DFLT_INPUT_DIR, DFLT_OUTPUT_DIR, DFLT_SQLITE_DB_PATH, DFLT_TABLE_PREFIX, DFLT_TS_DP } from './consts';
import { closeDb, initDB, readDB } from './db';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import blurFacesInEquirectangular from './blur-faces';

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
console.info("Using Args: DB:", sqlite_db_path, 'Input:', input_pic_dir, "Output:", output_pic_dir, "Img Extension:", img_ext, "Table Prefix:", table_prefix, "Batch size:", batch_size)

const processHasCompletedFileFilePath = path.join(output_pic_dir, "complete.txt")


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
      const outputImagePath = path.join(output_pic_dir, Number(row.ts).toFixed(ts_dp) + img_ext);
      console.log("Parsing ", inputImagePath)

      if (fs.existsSync(inputImagePath)) {
        console.log("File exists - blurring: ", blur)
        if (blur) await blurFacesInEquirectangular(inputImagePath, outputImagePath);
        else await copyFileIfExists(Number(row.ts).toFixed(ts_dp), input_pic_dir, output_pic_dir, img_ext)
      }
      else {
        console.error("File doesn't exist")
      }
    }));
  }
  fs.writeFileSync(processHasCompletedFileFilePath, "Completed run started at:" + time.toLocaleTimeString() + " and ended at:" + new Date().toLocaleTimeString())
}


// If the process is being rerun, we don't want the user confused whether this is a new run completed or the old one stuck around
if (fs.existsSync(processHasCompletedFileFilePath)) {
  fs.rmSync(processHasCompletedFileFilePath)
}

console.info("Init DB")
initDB(sqlite_db_path)
processImages().then(closeDb).catch(console.error);

import path from 'path'
import fs from 'fs'
import { DFLT_FACE_BLUR, DFLT_IMG_EXT, DFLT_INPUT_DIR, DFLT_OUTPUT_DIR, DFLT_SQLITE_DB_PATH, TS_DP } from './consts';
import { initDB, readDB } from './db';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const BATCH_SIZE = 5;

const args: any = yargs(hideBin(process.argv)).argv

if (args.h) {
  console.log(args)
  console.log(`
      Args and their defaults:
      --db=${DFLT_SQLITE_DB_PATH}
      --input_dir=${DFLT_INPUT_DIR}
      --output_dir=${DFLT_OUTPUT_DIR}
      --blur=${DFLT_FACE_BLUR}
      --img_ext=${DFLT_IMG_EXT}
      `)
  process.exit(0)
}

const sqlite_db_path = args.db ?? DFLT_SQLITE_DB_PATH
const input_pic_dir = args.input_dir ?? DFLT_INPUT_DIR
const output_pic_dir = args.output_dir ?? DFLT_OUTPUT_DIR
const apply_face_blur = args.blur ?? DFLT_FACE_BLUR
const img_ext = args.img_ext ?? DFLT_IMG_EXT
console.log("Using Args: DB:", sqlite_db_path, 'Input:', input_pic_dir, "Output:", output_pic_dir, "Apply Blur:", apply_face_blur, "Img Extension:", img_ext)


async function copyFileIfExists(file: string | number, input_pic_dir: string, output_pic_dir: string, img_ext: string) {
  const filePath = path.join(input_pic_dir, Number(file).toFixed(TS_DP) + img_ext);
  const outputPath = path.join(output_pic_dir, Number(file).toFixed(TS_DP) + img_ext);
  console.log(filePath, "to", outputPath);
  if (fs.existsSync(filePath) && !fs.existsSync(outputPath)) {
    await fs.promises.copyFile(filePath, outputPath);
  }
}

async function start() {


  const rows: { ts: string | number }[] = await readDB("SELECT ts FROM refined_nodes");

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(row => copyFileIfExists(row.ts, input_pic_dir, output_pic_dir, img_ext)));
  }
}


initDB(sqlite_db_path)
start().catch(console.error);
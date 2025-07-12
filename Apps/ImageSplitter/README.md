# ImageSplitter

A Node.js application that processes images from a SQLite database, with support for both local file operations and CloudFlare R2 bucket uploads using the S3 compatibility API. When using R2, the application automatically creates and uploads multiple resolution versions of each image.

## Features

- **Database Integration**: Reads image timestamps from SQLite database tables
- **Face Blurring**: Optional face detection and blurring using OpenCV
- **Batch Processing**: Configurable batch size for efficient processing
- **Local Storage**: Traditional file copying to local directories
- **CloudFlare R2 Support**: Upload images directly to CloudFlare R2 buckets with multiple resolutions
- **Multi-Resolution Uploads**: Automatically creates 4 different resolution versions when using R2
- **Resume Capability**: Tracks completion status to avoid reprocessing

## Image Resolutions

When using R2, each image is automatically processed and uploaded in 4 different resolutions:

| Quality | JPG quality | Filename Format |
|---------|------------|-----------------|
| preview | 5 | `{timestamp}-preview.jpg` |
| lowest | 20| `{timestamp}-lowest.jpg` |
|...| up to 100 | -name.jpg |

All images are converted to JPEG format with appropriate quality settings

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

3. (Optional) Copy the example environment file and configure it:
```bash
cp env.example .env
# Edit .env with your configuration
```

## Configuration

The application supports multiple configuration methods in order of precedence:
1. Command line arguments (highest priority)
2. Environment variables

### Environment Variables

The application supports configuration via environment variables or command-line arguments.

#### Database Configuration
- `CV_EXTRACT_IN_DB_NAME` - SQLite database filename
- `CV_DB_DIR` - Directory containing the database
- `CV_EXTRACT_TABLE_PREFIX` - Table prefix for database queries

#### Image Processing
- `CV_KEYFRAME_IMG_DIR` - Input directory containing source images
- `CV_EXTRACT_USED_IMAGES_DIR` - Output directory for processed images
- `CV_KEYFRAME_IMG_EXTENSION` - Image file extension (e.g., .png, .jpg)
- `CV_KEYFRAME_IMG_NAME_DP` - Decimal places for timestamp formatting
- `CV_EXTRACT_BATCH_SIZE` - Number of images to process in parallel
- `CV_EXTRACT_FACE_BLUR` - Enable face blurring (true/false)

#### CloudFlare R2 Configuration
- `CV_USE_R2` - Enable R2 uploads (true/false)
- `CV_R2_ENDPOINT` - R2 endpoint URL
- `CV_R2_BUCKET` - R2 bucket name
- `CV_R2_REGION` - R2 region (usually "auto")
- `CV_R2_ACCESS_KEY_ID` - R2 access key ID
- `CV_R2_SECRET_ACCESS_KEY` - R2 secret access key

**Note**: R2 access key ID and secret access key should remain in environment variables for security.

## Usage

### Basic Local Processing

```bash
npm start
```

### With Command Line Arguments

```bash
npm start -- --db=./maps/campus.db --input_dir=./pictures --output_dir=./refined_pictures --batch=10 --blur=true
```

### CloudFlare R2 Upload

```bash
npm start -- --use_r2=true --r2_endpoint=https://your-account-id.r2.cloudflarestorage.com --r2_bucket=your-bucket-name --r2_access_key_id=your-key --r2_secret_access_key=your-secret
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--db` | SQLite database path | `maps/campus.db` |
| `--input_dir` | Input images directory | `./pictures/` |
| `--output_dir` | Output images directory | `./refined_pictures/` |
| `--batch` | Batch size for processing | `5` |
| `--img_ext` | Image file extension | `.png` |
| `--dp` | Timestamp decimal places | `5` |
| `--prefix` | Database table prefix | `refined_` |
| `--blur` | Enable face blurring | `true` |
| `--use_r2` | Enable R2 uploads | `false` |
| `--r2_endpoint` | R2 endpoint URL | `https://your-account-id.r2.cloudflarestorage.com` |
| `--r2_bucket` | R2 bucket name | `your-bucket-name` |
| `--r2_region` | R2 region | `auto` |
| `--r2_access_key_id` | R2 access key ID | Required if using R2 |
| `--r2_secret_access_key` | R2 secret access key | Required if using R2 |

## CloudFlare R2 Setup

1. **Create an R2 Bucket**:
   - Log into your CloudFlare dashboard
   - Navigate to R2 Object Storage
   - Create a new bucket

2. **Create API Tokens**:
   - Go to "My Profile" > "API Tokens"
   - Create a custom token with R2 permissions
   - Note down the Access Key ID and Secret Access Key

3. **Configure Endpoint**:
   - Your R2 endpoint follows the pattern: `https://{account-id}.r2.cloudflarestorage.com`
   - Find your account ID in the CloudFlare dashboard

## Database Schema

The application expects a SQLite database with a table containing image timestamps. The default table structure is:

```sql
CREATE TABLE refined_nodes (
    ts REAL PRIMARY KEY,
    -- other columns...
);
```

## Processing Flow

1. **Database Query**: Reads timestamps from the specified table
2. **Image Processing**: For each timestamp:
   - Locates the corresponding image file
   - Applies face blurring if enabled
   - **Local Mode**: Copies to local directory
   - **R2 Mode**: Creates 4 resolution versions and uploads to R2 bucket
3. **Completion Tracking**: Creates a completion file to track processing status

### R2 Upload Process

When R2 is enabled, each image goes through the following process:

1. **Source Image**: Original image (with optional face blurring applied)
2. **Resolution Processing**: Creates 4 different resolution versions using Sharp
3. **Parallel Upload**: Uploads all versions to R2 bucket simultaneously
4. **Duplicate Prevention**: Skips uploads for files that already exist in R2
5. **Cleanup**: Removes temporary files after successful upload

## Error Handling

- Missing images are logged but don't stop processing
- R2 upload failures are logged with detailed error information
- The application gracefully handles network issues and retries

## Performance Considerations

- **Batch Size**: Adjust based on your system's capabilities and network speed
- **R2 Uploads**: Consider R2's rate limits and your network bandwidth
- **Face Blurring**: CPU-intensive operation, consider disabling for large datasets
- **Multi-Resolution Processing**: Each image creates 4 versions, increasing processing time
- **Parallel Processing**: R2 uploads happen in parallel for better performance
- **Memory Usage**: Image resizing uses additional memory, monitor for large batches

## Troubleshooting

### Common Issues

1. **R2 Authentication Errors**:
   - Verify your access key ID and secret access key
   - Ensure your API token has R2 permissions

2. **Missing Images**:
   - Check that image files exist in the input directory
   - Verify timestamp formatting matches file naming convention

3. **Database Connection Issues**:
   - Ensure the SQLite database file exists and is accessible
   - Check table prefix matches your database schema

### Debug Mode

Add `--h` flag to see all available options and their current values:

```bash
npm start -- --h
``` 
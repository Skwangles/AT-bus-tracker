#!/usr/bin/env python3
"""
CLI tool for managing image buckets in R2/S3.
Allows selecting a bucket and clearing it with confirmation.
"""

import os
import boto3
from dotenv import load_dotenv
from botocore.exceptions import ClientError

# Load environment variables from .env file
load_dotenv()

R2_ENDPOINT = os.getenv('CV_R2_ENDPOINT')
R2_BUCKET = os.getenv('CV_R2_BUCKET')
R2_ACCESS_KEY_ID = os.getenv('CV_R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('CV_R2_SECRET_ACCESS_KEY')
R2_REGION = os.getenv('CV_R2_REGION', 'auto')

# Set up boto3 S3 client for R2
s3 = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name=R2_REGION,
)


def list_buckets():
    """
    List all available buckets.
    Returns a list of bucket names.
    """
    try:
        response = s3.list_buckets()
        return [bucket['Name'] for bucket in response.get('Buckets', [])]
    except ClientError as e:
        print(f"Error listing buckets: {e}")
        return []


def get_bucket_object_count(bucket_name: str) -> int:
    """
    Get the number of objects in a bucket.
    """
    try:
        paginator = s3.get_paginator('list_objects_v2')
        count = 0
        for page in paginator.paginate(Bucket=bucket_name):
            if 'Contents' in page:
                count += len(page['Contents'])
        return count
    except ClientError as e:
        print(f"Error counting objects in bucket {bucket_name}: {e}")
        return -1


def clear_bucket(bucket_name: str) -> bool:
    """
    Clear all objects from a bucket.
    Returns True if successful, False otherwise.
    """
    try:
        print(f"Clearing bucket '{bucket_name}'...")
        
        # Use paginator to handle buckets with many objects
        paginator = s3.get_paginator('list_objects_v2')
        deleted_count = 0
        
        for page in paginator.paginate(Bucket=bucket_name):
            if 'Contents' not in page:
                continue
            
            # Prepare objects for deletion (max 1000 per request)
            objects_to_delete = [{'Key': obj['Key']} for obj in page['Contents']]
            
            if objects_to_delete:
                response = s3.delete_objects(
                    Bucket=bucket_name,
                    Delete={
                        'Objects': objects_to_delete,
                        'Quiet': False
                    }
                )
                
                deleted = len(response.get('Deleted', []))
                deleted_count += deleted
                
                if 'Errors' in response and response['Errors']:
                    print(f"Errors occurred while deleting: {response['Errors']}")
                    return False
                
                print(f"Deleted {deleted_count} objects...", end='\r')
        
        print(f"\nSuccessfully cleared bucket '{bucket_name}'. Deleted {deleted_count} objects.")
        return True
        
    except ClientError as e:
        print(f"Error clearing bucket {bucket_name}: {e}")
        return False


def select_bucket_interactive() -> str:
    """
    Interactive bucket selection.
    Returns the selected bucket name.
    """
    buckets = list_buckets()
    
    if not buckets:
        print("No buckets found or unable to list buckets.")
        print("Please enter a bucket name manually:")
        return input("Bucket name: ").strip()
    
    print("\nAvailable buckets:")
    for idx, bucket in enumerate(buckets, 1):
        count = get_bucket_object_count(bucket)
        count_str = f" ({count} objects)" if count >= 0 else " (unable to count)"
        print(f"  {idx}. {bucket}{count_str}")
    
    print(f"  {len(buckets) + 1}. Enter bucket name manually")
    
    while True:
        try:
            choice = input(f"\nSelect a bucket (1-{len(buckets) + 1}): ").strip()
            
            if choice.isdigit():
                choice_num = int(choice)
                if 1 <= choice_num <= len(buckets):
                    return buckets[choice_num - 1]
                elif choice_num == len(buckets) + 1:
                    manual_bucket = input("Enter bucket name: ").strip()
                    if manual_bucket:
                        return manual_bucket
                    print("Bucket name cannot be empty.")
                else:
                    print(f"Please enter a number between 1 and {len(buckets) + 1}")
            else:
                # Allow direct bucket name entry
                if choice:
                    return choice
                print("Please enter a valid choice or bucket name.")
        except KeyboardInterrupt:
            print("\n\nOperation cancelled.")
            exit(0)
        except Exception as e:
            print(f"Error: {e}")


def confirm_clear(bucket_name: str) -> bool:
    """
    Ask for confirmation before clearing a bucket.
    Returns True if confirmed, False otherwise.
    """
    count = get_bucket_object_count(bucket_name)
    count_str = f"{count} objects" if count >= 0 else "objects (unable to count)"
    
    print(f"\n⚠️  WARNING: You are about to clear bucket '{bucket_name}'")
    print(f"   This will delete all {count_str} in the bucket.")
    print(f"   This action cannot be undone!\n")
    
    while True:
        response = input("Are you sure you want to proceed? (y/n): ").strip().lower()
        if response in ('y', 'yes'):
            return True
        elif response in ('n', 'no'):
            return False
        else:
            print("Please enter 'y' or 'n'")


def main():
    """
    Main CLI entry point.
    """
    print("Image Bucket Management Tool")
    print("=" * 40)
    
    # Select bucket
    bucket_name = select_bucket_interactive()
    
    if not bucket_name:
        print("No bucket selected. Exiting.")
        return
    
    print(f"\nSelected bucket: {bucket_name}")
    
    # Confirm clearing
    if not confirm_clear(bucket_name):
        print("Operation cancelled.")
        return
    
    # Clear the bucket
    success = clear_bucket(bucket_name)
    
    if success:
        print(f"\n✓ Bucket '{bucket_name}' has been cleared successfully.")
    else:
        print(f"\n✗ Failed to clear bucket '{bucket_name}'.")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
        exit(0)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        exit(1)


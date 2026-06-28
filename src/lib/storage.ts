import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// In a real production environment, you would use AWS SDK (S3) or similar:
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure uploads directory exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create UPLOADS_DIR on startup:', err);
}

export const uploadBase64ToStorage = async (base64String: string, type: 'image' | 'thumbnail' = 'image'): Promise<string> => {
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String; // Return as is if it's already a URL or empty
  }

  // Extract base64 data and extension
  const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 string');
  }

  const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const data = Buffer.from(matches[2], 'base64');
  const filename = `${uuidv4()}-${type}.${extension}`;
  
  // Here we save to local disk for demonstration. 
  // In a real app, this is where you'd upload to S3/Liara Object Storage:
  // const s3 = new S3Client({ region: '...', endpoint: '...', credentials: { ... } });
  // await s3.send(new PutObjectCommand({ Bucket: '...', Key: filename, Body: data }));
  
  const filePath = path.join(UPLOADS_DIR, filename);
  await fs.promises.writeFile(filePath, data);
  
  // Return the URL that will be stored in the database
  return `/uploads/${filename}`;
};

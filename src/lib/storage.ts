import { v4 as uuidv4 } from 'uuid';

export const uploadBase64ToStorage = async (base64String: string, type: 'image' | 'thumbnail' = 'image'): Promise<string> => {
  // Since we are running in an ephemeral container environment (like Liara/Cloud Run),
  // we will just return the base64 string to be stored directly in the database.
  // The UI limits uploads to 100KB, which is perfectly safe for DB storage.
  return base64String;
};

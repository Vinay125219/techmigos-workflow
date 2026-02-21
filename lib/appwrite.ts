import { Account, Client, Databases } from "appwrite";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim();
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim();

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
  throw new Error(
    "Appwrite is not configured. Set NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT_ID before starting the app."
  );
}

const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);

export async function pingAppwrite() {
  return client.ping();
}

export { client, account, databases };

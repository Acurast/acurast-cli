import "dotenv/config";

export const getEnv = (
  key:
    | "ACURAST_MNEMONIC"
    | "ACURAST_IPFS_URL"
    | "ACURAST_IPFS_API_KEY"
    | "DEBUG"
): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

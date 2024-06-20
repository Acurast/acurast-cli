import axios from "axios";
import FormDataModule from "form-data";
import fs from "fs";
import path from "path";
import { getEnv } from "../config.js";

const environment = {
  ipfsUrl: getEnv("ACURAST_IPFS_URL"),
  ipfsApiKey: getEnv("ACURAST_IPFS_API_KEY"),
};

export const uploadScript = async (
  config: { file: string } | { script: string }
) => {
  const tempFile = "temp_script.js";

  if ("file" in config) {
    fs.copyFileSync(config.file, tempFile);
  } else {
    // Convert the script string to a buffer
    const buffer = Buffer.from(config.script, "utf-8");
    fs.writeFileSync(tempFile, buffer);
  }

  // Use form-data to create the form
  const form = new FormDataModule();
  form.append("file", fs.createReadStream(tempFile), "script.js");
  form.append("pinataOptions", '{"cidVersion": 0}');
  form.append("pinataMetadata", '{"name": "script.js"}');

  try {
    const res = await axios.post<{ IpfsHash: string }>(
      `${environment.ipfsUrl}/pinning/pinFileToIPFS`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${environment.ipfsApiKey}`,
        },
      }
    );

    // Clean up temp file
    fs.unlinkSync(tempFile);

    return `ipfs://${res.data.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading script:", error);
    // Clean up temp file in case of error
    fs.unlinkSync(tempFile);
    throw error;
  }
};

// // Example usage
// uploadScript({ script: 'console.log("Hello World");' })
//   .then((hash) => console.log("Uploaded script hash:", hash))
//   .catch((error) => console.error("Error:", error));

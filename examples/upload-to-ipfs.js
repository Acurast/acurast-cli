import { uploadScript } from '../dist/acurast/uploadToIpfs.js'
import { resolve } from 'path'

/**
 * Upload a file to IPFS using the Acurast CLI utilities
 *
 * Usage:
 *   node upload-to-ipfs.js <file-path>
 *
 * Example:
 *   node upload-to-ipfs.js ./test.js
 *
 * Environment Variables:
 *   ACURAST_IPFS_URL - IPFS endpoint (defaults to Acurast proxy)
 *   ACURAST_IPFS_API_KEY - API key for IPFS (optional for Acurast proxy)
 */

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Error: No file path provided')
    console.log('\nUsage: node upload-to-ipfs.js <file-path>')
    console.log('Example: node upload-to-ipfs.js ./test.js')
    process.exit(1)
  }

  const filePath = resolve(args[0])

  console.log(`Uploading file: ${filePath}`)
  console.log('Please wait...\n')

  try {
    const ipfsUri = await uploadScript({ file: filePath })

    console.log('✓ File uploaded successfully!')
    console.log(`IPFS URI: ${ipfsUri}`)
    console.log(`IPFS Hash: ${ipfsUri.replace('ipfs://', '')}`)

  } catch (error) {
    console.error('✗ Upload failed:', error.message)
    process.exit(1)
  }
}

main()

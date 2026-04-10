// Type declarations for Acurast processor runtime globals

declare function httpPOST(
  url: string,
  body: string,
  headers: Record<string, string>,
  onSuccess: (response: string, certificate: string) => void,
  onError: (error: string) => void
): void

declare const _DEVTOOLS_: {
  uploadFile(
    filename: string,
    content: string,
    mimeType: string,
    onSuccess: (fileInfo: {
      id: number
      filename: string
      mimeType: string
      fileSize: number
      createdAt: string
    }) => void,
    onError: (error: string) => void
  ): void
}

declare const _STD_: {
  job: {
    getId(): { origin: { kind: string; source: string }; id: string }
    getPublicKeys(): { p256: string; secp256k1: string; ed25519: string }
  }
  device: {
    getAddress(): string
  }
  env: Record<string, string>
  signers: {
    ed25519: {
      sign(payloadHex: string): string
    }
  }
}

export type FileReference = {
    id: string,
    fileName: string,
    size: number,
    fileDateTime: Date,
    fileContents: Uint8Array
}
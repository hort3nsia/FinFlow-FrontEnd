export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Unable to read the selected file.'));
    };

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to convert the selected file to base64.'));
        return;
      }

      const separatorIndex = reader.result.indexOf(',');
      resolve(separatorIndex >= 0 ? reader.result.slice(separatorIndex + 1) : reader.result);
    };

    reader.readAsDataURL(file);
  });
}

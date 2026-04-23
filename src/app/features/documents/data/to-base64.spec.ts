import { toBase64 } from './to-base64';

describe('toBase64', () => {
  it('converts a file to base64 without the data url prefix', async () => {
    const file = new File(['FinFlow'], 'sample.txt', { type: 'text/plain' });

    await expect(toBase64(file)).resolves.toBe('RmluRmxvdw==');
  });
});

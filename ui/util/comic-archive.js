import { Archive } from 'libarchive.js';

// Keep the old reader's 500-page limit, and bound allocations before extraction.
const MAX_BYTES = 512 * 1024 * 1024;
const MAX_PAGE_BYTES = 32 * 1024 * 1024;

export async function readComic(bytes, signal) {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const blob = new Blob([bytes]);
  if (blob.size > MAX_BYTES) throw new Error(__('This comic archive is too large to open.'));
  const worker = new Worker(
    process.env.NODE_ENV === 'production' ? 'webworkers/worker-bundle.js' : '/webworkers/worker-bundle.js',
    { type: 'module' }
  );
  let timer;
  let rejectStopped;
  const stopped = new Promise((resolve, reject) => {
    rejectStopped = reject;
  });
  const cancel = () => rejectStopped(new DOMException('Cancelled', 'AbortError'));
  const failed = (event) => {
    event.preventDefault();
    rejectStopped(new Error(__('The comic archive reader could not start.')));
  };
  signal.addEventListener('abort', cancel, { once: true });
  worker.addEventListener('error', failed);
  worker.addEventListener('messageerror', failed);
  const wait = async (operation) => {
    timer = setTimeout(() => rejectStopped(new Error(__('The comic archive took too long to open.'))), 30000);
    try {
      return await Promise.race([operation, stopped]);
    } finally {
      clearTimeout(timer);
    }
  };
  const urls = [];
  try {
    // getWorker is called synchronously by open; each reader owns its worker.
    Archive.init({ getWorker: () => worker });
    const opening = Archive.open(blob);
    Archive.init();
    const archive = await wait(opening);
    if (await wait(archive.hasEncryptedData())) throw new Error(__('Password-protected comics are not supported.'));
    const files = await wait(archive.getFilesArray());
    const images = files
      .filter(
        ({ file, path }) =>
          /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name) &&
          !/(^|\/)__MACOSX\//.test(path) &&
          !file.name.startsWith('._')
      )
      .sort((a, b) => (a.path + a.file.name).localeCompare(b.path + b.file.name, 'en', { numeric: true }));
    if (!images.length) throw new Error(__('This archive has no readable comic pages.'));
    if (images.length > 500) throw new Error(__('This comic has more than 500 pages.'));
    let total = 0;
    for (const { file } of images) {
      total += file.size;
      if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_PAGE_BYTES || total > MAX_BYTES) {
        throw new Error(__('The comic pages are too large to open.'));
      }
    }
    for (const { file } of images) {
      const page = await wait(file.extract());
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      urls.push(URL.createObjectURL(page));
    }
    return urls;
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    worker.removeEventListener('error', failed);
    worker.removeEventListener('messageerror', failed);
    worker.terminate();
  }
}

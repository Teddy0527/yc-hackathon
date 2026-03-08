// Screen capture module using html2canvas

import html2canvas from 'html2canvas';

const TARGET_WIDTH = 800;

/**
 * Capture the visible viewport as a base64-encoded JPEG string.
 * The image is scaled down to ~800px width for a reasonable payload size.
 * Returns the raw base64 string (no "data:" prefix).
 * Returns an empty string on error.
 */
export async function captureScreen(): Promise<string> {
  try {
    const canvas = await html2canvas(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scale: TARGET_WIDTH / window.innerWidth,
      useCORS: true,
      logging: false,
      // Ignore the GrandHelper panel so it doesn't appear in the screenshot
      ignoreElements: (el: Element): boolean => {
        return el.id === 'grandhelper-root';
      },
    });

    const dataUrl: string = canvas.toDataURL('image/jpeg', 0.7);
    // Strip the "data:image/jpeg;base64," prefix
    const base64: string = dataUrl.split(',')[1] || '';
    return base64;
  } catch (err) {
    console.warn('[GrandHelper] Screen capture failed:', err);
    return '';
  }
}

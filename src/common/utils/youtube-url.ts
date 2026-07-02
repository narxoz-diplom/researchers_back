export interface ParsedYoutubeUrl {
  videoId: string;
  watchUrl: string;
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:[^&]+&)*v=|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

export function parseYoutubeUrl(url: string): ParsedYoutubeUrl | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return {
        videoId,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  }
  return null;
}

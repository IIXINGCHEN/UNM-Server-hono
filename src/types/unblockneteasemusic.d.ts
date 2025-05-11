declare module '@unblockneteasemusic/server' {
  export default function match(
    id: number | string,
    source?: string[],
    data?: any
  ): Promise<{
    id: number | string;
    url: string;
    br: number;
    size: number;
    md5?: string;
    source: string;
    [key: string]: any;
  }>;
}
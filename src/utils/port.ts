import * as net from 'net';

export const checkPort = (port: number): Promise<number> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      console.log(`端口 ${port} 已被占用, 正在尝试其他端口...`);
      resolve(checkPort(port + 1));
    });

    server.once('listening', () => {
      server.close();
      resolve(port);
    });

    server.listen(port);
  });
};

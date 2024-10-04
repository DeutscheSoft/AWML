// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

async function connectRPC() {
  const topic = await ipcRenderer.invoke('awml-rpc-connect');

  return {
    send: (msg: unknown) => {
      ipcRenderer.send(topic, msg);
    },
    subscribe: (callback: (...args: unknown[]) => void) => {
      let active = true;
      if (typeof callback !== 'function')
        throw new TypeError('Expected function.');

      const cb = (event: IpcRendererEvent, ...args: unknown[]) =>
        callback(...args);
      ipcRenderer.on(topic, cb);

      return () => {
        if (!active) return;
        active = false;
        ipcRenderer.off(topic, cb);
      };
    },
  };
}

contextBridge.exposeInMainWorld('awmlRpc', {
  connectRPC,
});

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CNSEB', Object.freeze({
  getDeviceInfo: () => ipcRenderer.invoke('cnseb:device-info'),
  requestExit: () => ipcRenderer.send('cnseb:request-exit'),
  onExitBlocked: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('cnseb:exit-blocked', listener);
    return () => ipcRenderer.removeListener('cnseb:exit-blocked', listener);
  }
}));

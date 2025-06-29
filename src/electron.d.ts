// electron.d.ts
export {};

declare global {
    interface Window {
        ipcRenderer: IpcRenderer;
    }
}

interface IpcRenderer {
    on: (channel: string, callback: (...args: any[]) => void) => void;
    off: (channel: string, callback: (...args: any[]) => void) => void;
    send: (channel: string, data: any) => void;
    invoke: (channel: string, data: any) => Promise<any>;
}
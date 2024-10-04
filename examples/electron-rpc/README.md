This folder contains example code for creating a RPC connection
inside an electron application between the frontend (renderer)
and the backend (main) process. This is done using the electron
ipc mechanism.

The files in this folder have the following purpose:

- `preload.ts`: Is used as the electron preload script and exposes one method
  to the renderer process called `window.awmlRpc.connectRPC`.

- `connectBackendRPC.ts`: Is used to setup the RPC from the main process. This
  needs to be called somewhere during startup and before the first browser window
  is created.

- `connectFrontendRPC.ts`: Is used to establish an RPC connection from the frontend
  renderer.

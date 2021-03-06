const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { dialog } = require('electron');
const THREE = require('three');
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let vramwindow;
let menu;

let win_contents;

var sceneProjectFliename = '';
var sceneProject = {
  name: 'Untitled Scene',
  rooms: [],
  models: {},
  textures: {}
}

var newSceneProject = {
  name: 'Untitled Scene',
  rooms: [{
    label: 'Room 0',
    position_offset: THREE.Vector3()
  }],
  models: {},
  textures: {}
};

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: true
    }
  });
  
  win.once('ready-to-show', () => {
    win.show();
  });

  win_contents = win.webContents;
  
  menu = Menu.buildFromTemplate(mainMenuTemplate);
  Menu.setApplicationMenu(menu);

  // and load the index.html of the app.
  win.loadFile('index.html');

  // Open the DevTools.
  //win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
    vramwindow = null;
  });
}

// File Functions
// Open File
var openSceneProjectDialog = () => {
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Scene Project Files', extensions: ['scenejson'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    console.log('Open Scene Project');
    console.log(result.canceled);
    console.log(result.filePaths);
  }).catch(err => {
    console.log(err);
  });
}
// Save Project
var saveSceneProjectAsDialog = () => {
  return dialog.showSaveDialog({
    properties: ['createDirectory', 'showOverwriteConfirmation'],
    filters: [
      { name: 'Scene Project Files', extensions: ['scenejson'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    console.log('Save Scene Project');
    console.log(result.canceled);
    console.log(result.filePath);
    if(!result.canceled){
      sceneProjectFliename = result.filePath;
    }
  }).catch(err => {
    console.log(err);
  });
}
var saveSceneProjectDialog = () => {
  console.log('project filename:',sceneProjectFliename);
  if(sceneProjectFliename == ''){
    saveSceneProjectAsDialog();
  }
}
// Import Model
var importModelDialog = () => {
  dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'PSXJSON Models', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    console.log('Import Models');
    console.log(result.canceled);
    console.log(result.filePaths);
  }).catch(err => {
    console.log(err);
  });
}

var exportSceneBinaryDialog = () => {
  dialog.showSaveDialog({
    properties: ['createDirectory', 'showOverwriteConfirmation'],
    filters: [
      { name: 'PSX Scene Files', extensions: ['scn'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    console.log('Export Scene Binary');
    console.log(result.canceled);
    console.log(result.filePath);
  }).catch(err => {
    console.log(err);
  });
}
const mainMenuTemplate = [
  {
    label: 'File',
    submenu: [
      { label: 'New Scene' },
      {
        label: 'Open Scene',
        click: openSceneProjectDialog
      },
      {
        label: 'Save Scene',
        click: saveSceneProjectDialog
      },
      {
        label: 'Save Scene As...',
        click: saveSceneProjectAsDialog
      },
      { type: 'separator' },
      {
        label: 'Import Model',
        click: importModelDialog
      },
      { label: 'Export Model' },
      { type: 'separator' },
      {
        label: 'Export Scene Binary',
        click: exportSceneBinaryDialog
      },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { label: 'Add New Room'},
      { label: 'Remove Room...'},
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ]
  },
  {
    label: 'View',
    submenu: [
      { 
        label: 'View VRAM',
        click: function(){
          if(!vramwindow){
            vramwindow = new BrowserWindow({
              parent: win,
              width: 1024,
              height: 640,    
              show: false,
              skipTaskbar: true,
              title: 'VRAM Viewer',
              autoHideMenuBar: true,
              webPreferences: {
                nodeIntegration: true
              }
            });
            //vramwindow.removeMenu();
            vramwindow.loadFile('vramview.html');
            vramwindow.once('ready-to-show', () => {
              vramwindow.show();
            });
            vramwindow.on('closed', () => {
              vramwindow = null;
            });
          }
        }
      },
      { type: 'separator' },
      {
        type: 'checkbox',
        click: function(menuItem, browserWindow, event) {
          win_contents.send('view-commands', menuItem.checked ? 'toggle-grid-on' : 'toggle-grid-off');
        },
        label: 'Show Grid',
        checked: true
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Tools',
  },
  {
    label: 'Options',
  },
  {
    label: 'Help',
  }
];

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipcMain.on('request-vram-contents', (event, message) => {
  console.log('request vram update called');
  win.webContents.send('get-vram-contents');
});

ipcMain.on('update-vram-contents', (event, data) => {
  if(vramwindow !== undefined){
    vramwindow.webContents.send('vram-update', data);
  }
});
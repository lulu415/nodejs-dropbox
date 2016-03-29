"use strict"

let fs = require('fs')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let net = require('net')
let JsonSocket = require('json-socket')
let request = require("request")
let wrap = require('co-express')
require('songbird')

let argv = require('yargs')
    .default('dir', process.cwd())
    .default('event', 'create')
    .default('file', '')
    .default('port', '8001')
    .argv

const PORT = argv.port
const ROOT_DIR = '/Users/lyang23/code/nodejs/client_dir'

let socket = new JsonSocket(new net.Socket());
socket.connect(PORT, '127.0.0.1');
socket.on('connect', function () {
    socket.on('message', wrap(function* (message) {
          console.log(message)
          let messagePath = message.path
          let type = message.type
          let action = message.action
          let content = message.contents
          let filePath = path.resolve(path.join(ROOT_DIR, messagePath))
          if (type === 'dir') {
                if (action === 'delete') {
                    yield rimraf.promise(ROOT_DIR + messagePath);
                } else if (action === 'create') {
                    yield mkdirp.promise(ROOT_DIR + messagePath);
                }
          } else {
                if (action === 'delete') {
                    yield fs.promise.unlink(ROOT_DIR + messagePath)
                } else if (action === 'create') {
                   let options = {
                    method: "GET",
                    url: 'http://127.0.0.1:8000/' + messagePath,
                   }
                  yield request(options).pipe(fs.createWriteStream(ROOT_DIR + messagePath))
                }
            }
        }))

    })


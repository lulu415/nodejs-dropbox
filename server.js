"use strict";
let fs = require('fs')
let express = require('express')
var wrap = require('co-express');
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let mime = require('mime-types')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let argv = require('yargs')
    .default('dir', process.cwd())
    .argv

let chokidar = require('chokidar')
let net = require('net')
let JsonSocket = require('json-socket')

let songbird = require('songbird')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const ROOT_DIR = path.resolve(argv.dir)

let app = express()

if (NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

app.listen(PORT, ()=> console.log(`Listening @ http://127.0.0.1:${PORT}`))


app.get('*', setFileMeta, wrap(sendHeaders), wrap(function* (req, res) {
  if (res.body) {
    res.json(res.body)
    return
  }

  fs.createReadStream(req.filePath).pipe(res)
}))

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())

app.delete('*', setFileMeta, wrap(function* (req, res, next) {
    if (!req.stat) return res.send(400, 'Invalid Path')

    if (req.stat.isDirectory()) {
      yield rimraf.promise(req.filePath)
    } else yield fs.promise.unlink(req.filePath)
    res.end()
    next()
}))

app.put('*', setFileMeta, setDirDetails, wrap(function* (req, res, next) {
    if (req.stat) return res.send(405, 'File exists')
    yield mkdirp.promise(req.dirPath)

    if (!req.isDir) req.pipe(fs.createWriteStream(req.filePath))
    res.end()
    next()
}))

app.post('*', setFileMeta, setDirDetails, wrap(function* (req, res, next) {
    if (!req.stat) return res.send(405, 'File does not exist')
    if (req.isDir || req.stat.isDirectory()) return res.send(405, 'Path is a directory')

    yield fs.promise.truncate(req.filePath, 0)
    req.pipe(fs.createWriteStream(req.filePath))
    res.end()
    next()
}))

let tcpport = 8001
let server = net.createServer()
server.listen(tcpport)
console.log('LISTENING @ http://127.0.0.1:'+tcpport)
server.on('connection', function(socket) {
     socket = new JsonSocket(socket)
     let watch = chokidar.watch(ROOT_DIR, {ignored: /[\/\\]\./,persistent: true})
     watch.on('add', (path) => {
              let message = {
                action: 'create',
                path: path,
                type: 'file',
                contents: null,
                updated: new Date().getTime()
              }    
              socket.sendMessage(message)})
     watch.on('change', (path) => {
              let message = {
                action: 'create',
                path: path,
                type: 'file',
                contents: null,
                updated: new Date().getTime()
              }
              socket.sendMessage(message)})
     watch.on('unlink', (path) => {
              let message = {
                action: 'remove',
                path: path,
                type: 'file',
                contents: null,
                updated: new Date().getTime()
              }
              socket.sendMessage(message)})
     watch.on('addDir', (path) => {
              let message = {
                action: 'create',
                path: path,
                type: 'dir',
                contents: null,
                updated: new Date().getTime()
              }
              socket.sendMessage(message)})
     watch.on('unlinkDir', (path) => {
              let message = {
                action: 'remove',
                path: path,
                type: 'dir',
                contents: null,
                updated: new Date().getTime()
              }
              socket.sendMessage(message) })
     socket.on('end', () => {
            console.log("End connection")
            clients.splice(clients.indexOf(socket), 1)
        })
})



















function setDirDetails(req, res, next) {
  let filePath = req.filePath
  let endsWithSlash = filePath.charAt(filePath.length-1) === path.sep
  let hasExt = path.extname(filePath) !== ''
  req.isDir = endsWithSlash || !hasExt
  req.dirPath = req.isDir ? filePath : path.dirname(filePath)
  next()
}

function setFileMeta(req, res, next) {
  req.filePath = path.resolve(path.join(ROOT_DIR, req.url))
  if (req.filePath.indexOf(ROOT_DIR) !== 0) {
    res.send(400, 'Invalid path')
    return
  }
  fs.promise.stat(req.filePath)
    .then(stat => req.stat = stat, ()=> req.stat = null)
    .nodeify(next)
}

function* sendHeaders(req, res, next) {
    if (req.stat.isDirectory()) {
        let files = yield fs.promise.readdir(req.filePath)
        res.body = JSON.stringify(files)
        res.setHeader('Content-Length', res.body.length)
        res.setHeader('Content-Type', 'application/json')
        return
    }

    res.setHeader('Content-Length', req.stat.size)
    let contentType = mime.contentType(path.extname(req.filePath))
    res.setHeader('Content-Type', contentType)
    next()
}
